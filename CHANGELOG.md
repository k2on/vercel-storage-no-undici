# @vercel/edge-config

## 0.1.0-canary.13

### Minor Changes

- 667c121: drop /config

## 0.1.0-canary.12

### Patch Changes

- 0c78c58: use URL instead of URLPattern to support node

## 0.1.0-canary.11

### Minor Changes

- 578d34a: pass version via search param
- 81bfed2: renamedcreateEdgeConfigClient to createClient

### Patch Changes

- 99ac8af: access edge config via renamed folder

## 0.1.0-canary.10

### Patch Changes

- 85fb6ac: silence dependency expression warning

## 0.1.0-canary.9

### Patch Changes

- 9bf7828: avoid build time warning aboud Node.js module being loaded when used in Next.js

## 0.1.0-canary.8

### Patch Changes

- 7cb351a: replace dynamic import with fs

## 0.1.0-canary.7

### Minor Changes

- 888b861: drop cjs support

### Patch Changes

- 888b861: fix dynamic import by adding webpackIgnore comment

## 0.1.0-canary.6

### Patch Changes

- a048274: export esm
- a048274: use dynamic import

## 0.1.0-canary.5

### Patch Changes

- 311fedd: loosen edge config item value type to be "any"

## 0.1.0-canary.4

### Minor Changes

- b614218: drop esm support

## 0.1.0-canary.3

### Patch Changes

- 5aabd54: make package publicly available again

## 0.1.0-canary.2

### Minor Changes

- edf1cc9: Add getAll() method

  - `getAll()` allows fetching all items of an Edge Config
  - `getAll(keys: string[])` allows fetching a subset of the Edge Config's items

### Patch Changes

- 264ab8d: Throw when attempting to read value of non-existing Edge Config

## 0.1.0-canary.1

### Minor Changes

- Allow reading embedded edge configs