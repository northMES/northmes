// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation } from '@apollo/client/react';
import { coreLinks, createUser } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { useNavigate } from '@tanstack/react-router';
import type { z } from 'zod';
import { ErrorSummary } from '../../../../ui/components/error-summary/index.ts';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { TextField } from '../../../../ui/components/text-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { fieldErrorsOf } from '../../../../ui/lib/graphql-errors.ts';
import {
  fieldProps,
  setServerErrors,
  summaryErrors,
  useZodForm,
} from '../../../../ui/lib/use-zod-form.ts';
import { noAccessState } from '../../no-access.tsx';
import { handOverTemporaryPassword } from '../../temporary-password.ts';
import { usePlaces } from '../../use-places.ts';
import { useViewer } from '../../use-viewer.ts';
import { CoreUser } from '../../user.graphql.ts';
import { CoreCreateUser } from './create-user.graphql.ts';

type UserValues = z.output<typeof createUser.fields>;

/** The summary's heading: the number of fields to fix, or that the user was not created. */
function summaryHeading(fieldCount: number): string {
  if (fieldCount === 0) return 'Could not create the user';
  return `Fix ${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} to create the user`;
}

/** The New user form: Name, Username and Email, then Create user. */
function NewUserForm({ companyName }: { readonly companyName: string }) {
  const { plant } = useShell();
  const navigate = useNavigate();
  const form = useZodForm(createUser.fields, {
    defaultValues: { name: '', username: '', email: undefined },
  });
  const [create] = useMutation(CoreCreateUser, {
    // The user's page reads the new user from the cache.
    update(cache, { data }) {
      if (!data) return;
      const { user } = data.coreCreateUser;
      cache.writeQuery({ query: CoreUser, variables: { id: user.id }, data: { coreUser: user } });
    },
  });
  const { isDirty, isSubmitting } = form.formState;

  const save = async (values: UserValues) => {
    try {
      const { data } = await create({ variables: { input: values } });
      if (!data) return;
      const { user, temporaryPassword } = data.coreCreateUser;
      handOverTemporaryPassword(user.id, temporaryPassword);
      await navigate({
        to: coreLinks.users.user({ plant, userId: user.id }).href,
        replace: true,
      });
    } catch (error) {
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
  const email = form.register('email', {
    setValueAs: (value: string) => (value.trim() === '' ? undefined : value.trim()),
  });
  return (
    <form noValidate onSubmit={form.handleSubmit(save)} className="flex max-w-190 flex-col gap-4">
      <ErrorSummary
        heading={summaryHeading(errors.filter(({ name }) => name !== undefined).length)}
        errors={errors}
        focusKey={form.formState.submitCount}
      />
      <FormSection title="Person" description={`A user of ${companyName}.`}>
        <TextField label="Name" autoComplete="off" {...fieldProps(form, 'name')} />
        <TextField
          label="Username"
          autoComplete="off"
          className="max-w-xs"
          hint="Used to sign in. It cannot be changed later, and no one else can ever use it."
          {...fieldProps(form, 'username')}
        />
        <TextField
          label="Email"
          type="email"
          optional
          autoComplete="off"
          hint="Leave it empty for a person without email, such as an operator who signs in at a station."
          {...email}
          error={form.getFieldState('email', form.formState).error?.message}
        />
        <p className="text-sm text-muted-foreground">
          NorthMES makes a temporary password and shows it to you once after you create the user.
        </p>
      </FormSection>
      <FormActions
        saveLabel="Create user"
        saving={isSubmitting}
        cancelHref={coreLinks.users({ plant }).href}
        dirty={isDirty}
      />
      <UnsavedChangesGuard when={isDirty && !isSubmitting} />
    </form>
  );
}

/**
 * New user (design core-304, US5 to US10): Name, Username and an optional Email, then Create
 * user. The created user's page replaces the form in the history and shows the temporary
 * password once. A taken or retired username lands on Username with the typed values kept. A
 * reader without core.user:create gets the page "No access to New user".
 */
export function NewUserScreen() {
  const { plant } = useShell();
  const places = usePlaces();
  const viewer = useViewer();
  const forbidden = viewer.loaded && !viewer.can('core.user:create');
  let state: PageState = { status: 'ready' };
  if (forbidden) {
    state = noAccessState('New user', 'core.user:create', places.plant?.name ?? plant);
  } else if (!viewer.loaded) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame
      title={forbidden ? 'No access to New user' : 'New user'}
      crumbs={[{ label: 'Users', href: coreLinks.users({ plant }).href }]}
      state={state}
    >
      {viewer.loaded && !forbidden && (
        <NewUserForm companyName={places.company?.name ?? 'the company'} />
      )}
    </PageFrame>
  );
}
