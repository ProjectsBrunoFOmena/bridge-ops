INSERT INTO users (id, email, password_hash, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'viewer@demo.local', 'viewer123', 'viewer'),
  ('00000000-0000-0000-0000-000000000002', 'operator@demo.local', 'operator123', 'operator')
ON CONFLICT (email) DO NOTHING;
