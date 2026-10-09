// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, createUser } from '@northmes/core-contracts';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import type { z } from 'zod';
import { ErrorSummary, ErrorSummaryAction } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { detailsOf, fieldErrorsOf } from '../../../../ui/lib/graphql-errors.ts';
import {
  fieldProps,
  setServerErrors,
  summaryErrors,
  useZodForm,
} from '../../../../ui/lib/use-zod-form.ts';
import { noAccessState } from '../../no-access.tsx';
import { handOverTemporaryPassword } from '../../temporary-password.ts';
import { useCompanyId, usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreUser } from '../../user.graphql.ts';
import { CoreCreateUser } from './create-user.graphql.ts';

type UserValues = z.output<typeof createUser.fields>;

/** The summary's heading: the number of fields to fix, or that the user was not created. */
function summaryHeading(fieldCount: number): string {
  if (fieldCount === 0) return 'Could not create the user';
  return `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to create the user`;
}

/** A user that an earlier try of Create user created, whose temporary password is not known. */
interface CreatedBefore {
  readonly userId: string;
  readonly username: string;
}

/**
 * The New user form (design core-304, US5 to US8): Person with Name, Username and Email, Password,
 * which says the password is temporary and must be replaced at the first sign-in, and the optional
 * Reason for change, then Create user. Create user sends the values under
 * a uuidv7 the form made once (ADR 0012). A retry after a first try that failed before its answer
 * finishes the creation. A retry after a first try that created the user, whose answer with the
 * temporary password was lost, is refused with core.user_created_password_hidden: the form says the
 * user was created and offers Open user, since NorthMES cannot show the password again.
 */
function NewUserForm() {
  const companyId = useCompanyId() ?? '';
  const navigate = useNavigate();
  const [id] = useState(() => uuidv7());
  const [createdBefore, setCreatedBefore] = useState<CreatedBefore>();
  const form = useZodForm(createUser.fields, {
    defaultValues: { name: '', username: '', email: '', reason: '' },
  });
  const [create] = useMutation(CoreCreateUser, {
    // The user's page reads the new user from the cache.
    update(cache, { data }) {
      if (!data) return;
      const { user } = data.coreCreateUser;
      cache.writeQuery({
        query: CoreUser,
        variables: { id: user.id, companyId },
        data: { coreUser: user },
      });
    },
  });
  const { isDirty, isSubmitting } = form.formState;

  const save = async (values: UserValues) => {
    setCreatedBefore(undefined);
    try {
      const { reason, ...rest } = values;
      const input = { ...rest, ...(reason ? { reason } : {}), id, companyId };
      const { data } = await create({ variables: { input } });
      if (!data) return;
      const { user, temporaryPassword } = data.coreCreateUser;
      handOverTemporaryPassword(user.id, temporaryPassword);
      await navigate({
        to: coreLinks.settings.users.user({ companyId, userId: user.id }).href,
        replace: true,
      });
    } catch (error) {
      const userId = detailsOf(error, 'core.user_created_password_hidden')?.userId;
      if (typeof userId === 'string') {
        setCreatedBefore({ userId, username: values.username });
        return;
      }
      const fieldErrors = fieldErrorsOf(error).map((entry) =>
        entry.code === 'core.username_taken'
          ? {
              ...entry,
              message: `The username ${values.username} is taken or was used before. Choose another username.`,
            }
          : entry,
      );
      if (fieldErrors.length > 0) {
        setServerErrors(form, fieldErrors);
        return;
      }
      form.setError('root.server', {
        type: 'server',
        message: 'Your entries are kept. Try again.',
      });
    }
  };

  const errors = summaryErrors(form.formState.errors);
  const email = form.register('email', { setValueAs: (value: string) => value.trim() });
  const name = form.watch('name').trim();
  return (
    <form noValidate onSubmit={form.handleSubmit(save)} className="flex max-w-190 flex-col gap-4">
      {createdBefore === undefined ? (
        <ErrorSummary
          heading={summaryHeading(errors.filter(({ name }) => name !== undefined).length)}
          errors={errors}
          focusKey={form.formState.submitCount}
        />
      ) : (
        <ErrorSummary
          heading={`The user ${createdBefore.username} was created`}
          errors={[]}
          focusKey={form.formState.submitCount}
        >
          <p>
            An earlier try of Create user created this user, but its answer with the temporary
            password did not arrive. NorthMES cannot show the temporary password again.
          </p>
          <ErrorSummaryAction
            label="Open user"
            onAction={() =>
              navigate({
                to: coreLinks.settings.users.user({ companyId, userId: createdBefore.userId }).href,
                replace: true,
              })
            }
          />
        </ErrorSummary>
      )}
      <FormSection title="Person">
        <TextField label="Name" autoComplete="off" {...fieldProps(form, 'name')} />
        <TextField
          label="Username"
          autoComplete="off"
          className="max-w-xs"
          hint="Shown in lists of users. It cannot be changed later, and no one else can ever use it."
          {...fieldProps(form, 'username')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          hint="Used to sign in."
          {...email}
          error={form.getFieldState('email', form.formState).error?.message}
        />
      </FormSection>
      <FormSection title="Password">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold">Password</p>
          <p className="text-sm">Temporary, shown to you once after you create the user</p>
          <p className="text-xs text-muted-foreground">
            {name === '' ? 'The user' : name} must choose a new password at the first sign-in.
          </p>
        </div>
      </FormSection>
      <FormSection title="Reason for change">
        <TextareaField
          label="Reason"
          optional
          placeholder="Why you create this user"
          hint={`Shown in the user's history. Do not enter personal data. Up to 500 characters.`}
          maxLength={500}
          {...fieldProps(form, 'reason')}
        />
      </FormSection>
      <FormActions
        saveLabel="Create user"
        saving={isSubmitting}
        cancelHref={coreLinks.settings.users({ companyId }).href}
        dirty={isDirty}
      />
      <UnsavedChangesGuard when={isDirty && !isSubmitting && createdBefore === undefined} />
    </form>
  );
}

/**
 * New user (design core-304, US5 to US10): Name, Username and Email, then Create user. Every user
 * signs in with their email; the maintainer's decision supersedes the design's frames of an
 * operator without email (US5, US6), who signs in with a badge at the operator station instead.
 * The created user's page replaces the form in the history and shows the temporary password once.
 * A taken or retired username lands on Username with the typed values kept. A reader without
 * core.user:create gets the page "No access to New user".
 */
export function NewUserScreen() {
  const companyId = useCompanyId() ?? '';
  const places = usePlaces();
  const viewer = useViewer();
  // The API checks core.user:create at the company (its scope hook).
  const forbidden = viewer.loaded && !viewer.canAtCompany('core.user:create');
  const companyName = places.company?.name ?? 'the company';
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState(
      'New user',
      'core.user:create',
      companyName,
      `a company admin of ${companyName}`,
    );
  } else if (!viewer.loaded) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to New user' : 'New user'}
      crumbs={[{ label: 'Users', href: coreLinks.settings.users({ companyId }).href }]}
      state={state}
    >
      {viewer.loaded && !forbidden && <NewUserForm />}
    </PageFrame>
  );
}
