-- Rollback for 0005_views_and_search. Run manually; not auto-executed by the CLI.
drop function if exists search_all(text);
drop view if exists outfit_v;
