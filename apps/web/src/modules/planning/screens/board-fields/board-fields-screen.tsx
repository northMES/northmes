// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { useShell } from '@northmes/web-sdk';
import { useSearch } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FormActions } from '../../../../ui/components/form-actions/index.ts';
import { FormSection } from '../../../../ui/components/form-section/index.ts';
import { PageFrame, type PageState } from '../../../../ui/components/page-frame/index.ts';
import { TextareaField } from '../../../../ui/components/textarea-field/index.ts';
import { UnsavedChangesGuard } from '../../../../ui/components/unsaved-changes-guard/index.ts';
import { Skeleton } from '../../../../ui/primitives/skeleton.tsx';
import {
  type BoardFieldLists,
  boardFieldCatalog,
  boardFieldOption,
  maxBlockFields,
} from '../../board-fields.ts';
import { boardFieldsSearch } from '../../board-fields-search.ts';
import { useBoardFieldSettings, useBoardFieldsStore } from '../../board-fields-store.ts';
import type { GanttSnapshot } from '../../gantt-data.ts';
import { usePlanningSnapshot } from '../../use-planning-snapshot.ts';
import { BoardFieldsListCard, type BoardFieldsListText } from './board-fields-list-card.tsx';
import { BoardFieldsPreview } from './board-fields-preview.tsx';

/** A plant's own lists as the form holds them: null for a list that uses the company value. */
interface OwnLists {
  readonly block: readonly string[] | null;
  readonly hover: readonly string[] | null;
}

const blockText: BoardFieldsListText = {
  label: 'Block fields',
  settingKey: 'boardBlockFields',
  description: `The fields a job order block shows after its job number and state markers, in this order. Full blocks show every field on two lines, compact blocks the first, bars none. Up to ${maxBlockFields} fields.`,
  defaultText: 'Article, Quantity, End',
  effect:
    'The Gantt draws these fields on every job order block after you save, and the planning board once it draws blocks. A module field draws at the trailing edge.',
  addLabel: 'Add block field',
  emptyTitle: 'No block fields',
  emptyText: 'Blocks show the job number and the state markers only.',
  limit: maxBlockFields,
};

const hoverText: BoardFieldsListText = {
  label: 'Hover fields',
  settingKey: 'boardHoverFields',
  description:
    'The fields the hover card lists after its title line and state badges, in this order. Details shows the same fields in the same order, so every one can be read without a pointer.',
  defaultText:
    'Operation, Article, Quantity, Setup start, End, Machine, Order deadline, Status, Customer',
  effect:
    "The Gantt's hover card and Details list these fields for every job order after you save. The hover card opens on hover and on keyboard focus.",
  addLabel: 'Add hover fields',
  emptyTitle: 'No hover fields',
  emptyText:
    'The hover card shows the title line and the state badges only, and Details keeps its fixed sections.',
};

function sameLists(a: OwnLists, b: OwnLists): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The form of a loaded page: both list cards, the preview, the reason and the Save bar. */
function BoardFieldsForm({
  snapshot,
  plant,
  company,
  saved,
}: {
  readonly snapshot: GanttSnapshot;
  readonly plant: string;
  readonly company: BoardFieldLists;
  /** The plant's own lists as saved, or as a previewed state starts them. */
  readonly saved: OwnLists;
}) {
  const store = useBoardFieldsStore();
  const [own, setOwn] = useState<OwnLists>(saved);
  const [savedNow, setSavedNow] = useState<OwnLists>(saved);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const catalog = useMemo(() => boardFieldCatalog(snapshot), [snapshot]);
  const optionOf = (id: string) => boardFieldOption(id, catalog);
  const plantName = snapshot.plants?.find((each) => each.slug === plant)?.name ?? plant;
  const dirty = !sameLists(own, savedNow);
  const shown: BoardFieldLists = {
    block: own.block ?? company.block,
    hover: own.hover ?? company.hover,
  };
  const setCount = [own.block, own.hover].filter((list) => list !== null).length;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        store.save(plant, own);
        setSavedNow(own);
        setStatus('Board fields saved.');
      }}
    >
      <UnsavedChangesGuard when={dirty} />
      <p className="max-w-[55rem] text-sm text-muted-foreground">
        {plantName} takes each list from the company unless you set it here.{' '}
        {setCount === 0
          ? 'Both lists use the company value.'
          : `${setCount} ${setCount === 1 ? 'list is' : 'lists are'} set for ${plantName}.`}{' '}
        A changed list applies to the Gantt after you save.
      </p>
      <p className="text-xs text-muted-foreground">
        {snapshot.fixture !== undefined && `Showing fixture ${snapshot.fixture}. `}
        Saved lists stay in this browser tab until planning settings have their API; a reload starts
        from the company value again.
      </p>
      <BoardFieldsListCard
        text={blockText}
        plantName={plantName}
        companyIds={company.block}
        ownIds={own.block}
        optionOf={optionOf}
        catalog={catalog}
        onChange={(block) => setOwn((current) => ({ ...current, block }))}
      />
      <BoardFieldsListCard
        text={hoverText}
        plantName={plantName}
        companyIds={company.hover}
        ownIds={own.hover}
        optionOf={optionOf}
        catalog={catalog}
        onChange={(hover) => setOwn((current) => ({ ...current, hover }))}
      />
      <BoardFieldsPreview snapshot={snapshot} lists={shown} saved={!dirty} />
      <FormSection title="Reason for change">
        <TextareaField
          label="Reason"
          optional
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Shown in the history of the planning settings once it exists. Do not enter personal data. Up to 500 characters."
        />
      </FormSection>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
      <FormActions
        saveLabel="Save board fields"
        saving={false}
        onCancel={() => {
          setOwn(savedNow);
          setReason('');
          setStatus('');
        }}
        dirty={dirty}
        note="Nothing moves on the plan; only what blocks and hover cards show changes."
      />
    </form>
  );
}

/**
 * The board fields page in plant settings (plan 07, Board settings; #762): which fields a job
 * order block and its hover card show on the board and the Gantt. Each list uses the company
 * value or the plant's own, as each planning rule does (#766). The page reads the plan of the
 * fixture G1 for the ERP keys and the preview, and saves to the in-memory store the board and the
 * Gantt read, until planning settings have their API. The URL's preview opens the loading, could
 * not load, no access and empty states (BF10 to BF13).
 */
export function BoardFieldsScreen() {
  const { plant } = useShell();
  const search = boardFieldsSearch(useSearch({ strict: false }));
  const { snapshot, error, retry } = usePlanningSnapshot();
  const settings = useBoardFieldSettings();
  const { preview } = search;
  const company = settings.company;
  const savedOwn = settings.plants[plant];
  const saved: OwnLists =
    preview === 'empty'
      ? { block: [], hover: [] }
      : { block: savedOwn?.block ?? null, hover: savedOwn?.hover ?? null };

  let state: PageState = { status: 'ready' };
  if (preview === 'forbidden') {
    state = {
      status: 'empty',
      icon: Lock,
      title: 'You need the permission to change board fields at this plant',
      description:
        'Board fields are planning settings. Ask your plant admin for a role that can change the plant settings.',
    };
  } else if (preview === 'error' || (snapshot === undefined && error !== undefined)) {
    state = {
      status: 'error',
      title: 'Could not load the board fields',
      error: error ?? new Error('Previewed failure'),
      onRetry: retry,
    };
  } else if (preview === 'loading' || snapshot === undefined) {
    state = { status: 'loading' };
  }
  return (
    <PageFrame title="Board fields" state={state}>
      {state.status === 'loading' && (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <p className="text-sm text-muted-foreground">Loading the board fields</p>
        </div>
      )}
      {state.status === 'ready' && snapshot !== undefined && (
        <BoardFieldsForm
          // A changed preview starts the form again; a Save keeps it, its focus and its reason.
          key={preview ?? 'saved'}
          snapshot={snapshot}
          plant={plant}
          company={company}
          saved={saved}
        />
      )}
    </PageFrame>
  );
}
