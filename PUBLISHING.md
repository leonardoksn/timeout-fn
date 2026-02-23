# Publishing Guide for timeout-fn

## Before Publishing

1. **Verify everything works:**
   ```bash
   npm run typecheck   # Check TypeScript types
   npm test            # Run all tests
   npm run build       # Build the library
   ```

2. **Test locally:**
   ```bash
   npm pack            # Creates a tarball
   # Test in another project:
   npm install /path/to/timeout-fn-1.0.0.tgz
   ```

3. **Update package.json:**
   - Set correct version
   - Add repository URL
   - Add author information
   - Review keywords

## Publishing to npm

1. **Login to npm:**
   ```bash
   npm login
   ```

2. **Publish:**
   ```bash
   npm publish
   ```

   Or for scoped packages:
   ```bash
   npm publish --access public
   ```

## Post-Publishing

1. **Tag the release on GitHub:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Create GitHub release with changelog**

## Version Management

Use semantic versioning:
- Patch: Bug fixes (`1.0.1`)
- Minor: New features, backward compatible (`1.1.0`)
- Major: Breaking changes (`2.0.0`)

```bash
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0
```

## CI/CD (Optional)

Consider adding GitHub Actions for:
- Running tests on PR
- Automatic npm publishing on release
- Checking code coverage

## Badges for README

After publishing, you can add badges:
```markdown
[![npm version](https://img.shields.io/npm/v/timeout-fn.svg)](https://www.npmjs.com/package/timeout-fn)
[![npm downloads](https://img.shields.io/npm/dm/timeout-fn.svg)](https://www.npmjs.com/package/timeout-fn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```
