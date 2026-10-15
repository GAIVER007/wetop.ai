-- Откат …075: снимает закреплённый search_path у membership_scope_guard().
ALTER FUNCTION membership_scope_guard() RESET search_path;
