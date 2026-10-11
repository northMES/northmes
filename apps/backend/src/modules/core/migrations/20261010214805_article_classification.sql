-- migration: expand
-- An article's stock unit, note, source and creation time (design ui-222, DE1).
--
-- stock_unit is a code of the unit catalog in @northmes/contracts, in which the article's
-- quantities are counted (ADR 0023). Existing articles count in pieces, as ADR 0023 gives
-- imported ones. A unit added to the catalog's stock units widens the check.
alter table core.article
  add column stock_unit text not null default 'PIECE'
    constraint article_stock_unit_check check (stock_unit in ('PIECE', 'METRE', 'KILOGRAM', 'LITRE')),
  add column note text
    constraint article_note_check check (note <> '' and char_length(note) <= 2000),
  -- The integration that created the article through core.upsertArticle, such as Pyramid, or null
  -- for an article created in NorthMES.
  add column source text
    constraint article_source_check check (source <> '' and char_length(source) <= 64),
  add column created_at timestamptz not null default now();

-- An id made by NorthMES is a uuidv7, which holds the time it was made, so such an article gets the
-- time it was created. A client may send an id of another version, which holds no time; that
-- article gets its last change, the nearest time known. Filling the column is no change to an
-- article, so it keeps its version and its last change.
alter table core.article disable trigger bump_version, disable trigger touch_updated_at;
update core.article set created_at = coalesce(uuid_extract_timestamp(id), updated_at);
alter table core.article enable trigger bump_version, enable trigger touch_updated_at;
