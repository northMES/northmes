-- migration: expand
-- Better Auth rotates the JWT signing key every 30 days (JWT_KEY_ROTATION_SECONDS in
-- auth-options.ts). It only rotates a key that has an expiry, and a key minted before rotation was
-- turned on has none, so each such key expires 30 days after it was created (audit B12).
update auth.jwks set "expiresAt" = "createdAt" + interval '720 hours' where "expiresAt" is null;
