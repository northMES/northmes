-- migration: expand
-- The translations of an article's name (ADR 0053): an array of { field, locale, text }, where
-- field is name and locale a BCP 47 tag in its canonical form. The contract checks each entry;
-- the column holds an array, so a reader can rely on one.
alter table core.article
  add column translations jsonb not null default '[]'
    constraint article_translations_check check (jsonb_typeof(translations) = 'array');
