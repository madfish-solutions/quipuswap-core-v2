# Test coverage for contracts

## BakerRegistry

1. `validate`:

   - ✅ should do nothing if baker is registered;
   - ✅ should register a new baker if baker is not registered;
   - ✅ should fail if the baker is not registered and the address to register is not a baker.

2. `register`:

   - ✅ should register a new baker;
   - ✅ should fail if address to register is not a baker.
