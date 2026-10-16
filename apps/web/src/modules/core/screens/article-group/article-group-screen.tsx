// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useMutation, useQuery } from '@apollo/client/react';
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Archive } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PageState } from '../../../../ui/components/page-frame/index.ts';
import { PageFrame } from '../../../../ui/components/page-frame/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';
import { announce } from '../../../../ui/lib/announce.ts';
import { fieldId } from '../../../../ui/lib/field-id.ts';
import { hasErrorCode } from '../../../../ui/lib/graphql-errors.ts';
import { useZodForm } from '../../../../ui/lib/use-zod-form.ts';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { CoreArticleGroups } from '../../article-groups.graphql.ts';
import {
  ArticleGroupForm,
  type ArticleGroupValues,
  articleGroupFormFields,
  showGroupSaveError,
} from '../../components/article-group-form/index.ts';
import { useViewer } from '../../use-viewer.ts';
import { type ArticleGroup, CoreArticleGroup } from './article-group.graphql.ts';
import { ArticleGroupActions } from './article-group-actions.tsx';
import { CoreUpdateArticleGroup } from './update-article-group.graphql.ts';

interface GroupFormProps {
  readonly group: ArticleGroup;
  readonly reload: () => Promise<ArticleGroup | undefined>;
}

/**
 * The group's form as it was when the page opened. Save sends the version the form was filled
 * from as expectedVersion, so a change someone saved in between is refused with
 * core.version_conflict, not overwritten. A saved change returns to the list.
 */
function GroupForm({ group, reload }: GroupFormProps) {
  const { plant } = useShell();
  const navigate = useNavigate();
  const viewer = useViewer();
  const expectedVersion = useRef(group.version);
  const [conflict, setConflict] = useState(false);
  const form = useZodForm(articleGroupFormFields, {
    defaultValues: { code: group.code, name: group.name },
  });
  const [update] = useMutation(CoreUpdateArticleGroup, { refetchQueries: [CoreArticleGroups] });
  const groups = coreLinks.articleGroups({ plant }).href;

  const save = async (values: ArticleGroupValues) => {
    setConflict(false);
    try {
      const { data } = await update({
        variables: { input: { id: group.id, expectedVersion: expectedVersion.current, ...values } },
      });
      if (!data) return;
      announce(`Article group ${data.coreUpdateArticleGroup.code} saved`);
      await navigate({ to: groups, replace: true });
    } catch (error) {
      if (hasErrorCode(error, 'core.version_conflict')) {
        setConflict(true);
        return;
      }
      showGroupSaveError(form, error, values);
    }
  };

  const onReload = async () => {
    const saved = await reload().catch(() => undefined);
    if (saved === undefined) return;
    form.reset({ code: saved.code, name: saved.name });
    expectedVersion.current = saved.version;
    setConflict(false);
    document.getElementById(fieldId('code'))?.focus();
  };

  return (
    <ArticleGroupForm
      form={form}
      onSave={save}
      cancelHref={groups}
      conflict={conflict ? { onReload } : undefined}
      editable={group.archivedAt === null && viewer.canAtCompany('core.articleGroup:update')}
    />
  );
}

/** The page state of a group that is loading, missing or failed. */
function groupState(
  group: ArticleGroup | null | undefined,
  error: unknown,
  retry: () => Promise<unknown>,
  listHref: string,
): PageState {
  if (group === undefined && error !== undefined) {
    return { status: 'error', title: 'Could not load the article group', error, onRetry: retry };
  }
  if (group === undefined) return { status: 'loading' };
  if (group === null) {
    return {
      status: 'empty',
      title: 'This article group does not exist or you cannot see it',
      description: 'The link may be out of date, or the group belongs to another company.',
      action: (
        <Link to={listHref} className={buttonVariants({ variant: 'outline' })}>
          Back to Article groups
        </Link>
      ),
    };
  }
  return { status: 'ready' };
}

/**
 * An article group's page, which is its form, as a register's is (design ui-222, DE37): its code
 * in the h1, Code and Name, Save article group for a holder of core.articleGroup:update at the
 * company, and Archive or Restore in the page actions. An archived group carries the Archived
 * badge and cannot be changed until it is restored.
 */
export function ArticleGroupScreen() {
  const { plant } = useShell();
  const { articleGroupId } = useParams({ strict: false });
  const { data, error, refetch } = useQuery(CoreArticleGroup, {
    variables: { id: articleGroupId ?? '' },
  });
  const group = data === undefined ? undefined : data.coreArticleGroup;
  const listHref = coreLinks.articleGroups({ plant }).href;
  const reload = async () => (await refetch()).data?.coreArticleGroup ?? undefined;
  return (
    <PageFrame
      title={group ? `Article group ${group.code}` : 'Article group'}
      crumbs={[{ label: 'Article groups', href: listHref }]}
      actions={group ? <ArticleGroupActions group={group} /> : undefined}
      state={groupState(group, error, () => refetch(), listHref)}
    >
      {group?.archivedAt != null && (
        <p>
          <StatusBadge tone="neutral" icon={Archive}>
            Archived
          </StatusBadge>
        </p>
      )}
      {group && <GroupForm key={`${group.id} ${group.version}`} group={group} reload={reload} />}
    </PageFrame>
  );
}
