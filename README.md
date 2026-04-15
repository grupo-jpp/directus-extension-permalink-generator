# @grupo-jpp/directus-extension-permalink-generator

A **Directus 11.x interface extension** that merges the best features of two open-source projects into a single, production-ready permalink generator with full accent support.

> **Built by merging:**
> - [letrthang/directus-cms-permalink-generator](https://github.com/letrthang/directus-cms-permalink-generator) — hierarchical parent-chain slug resolution
> - [dimitrov-adrian/directus-extension-wpslug-interface](https://github.com/dimitrov-adrian/directus-extension-wpslug-interface) — WordPress-style slugify UX: auto-generation, clickable preview, inline editing, micromustache templates, and `@sindresorhus/slugify`

---

## Features

| Feature | Description |
|---|---|
| 🔤 **Accent-safe slugify** | Uses `@sindresorhus/slugify` — `vestuário` → `vestuario` ✅ |
| 🌳 **Hierarchical parents** | Resolves parent chain recursively → `bicicletas/mtb/29er` |
| ⚡ **Auto-generation** | Watches form values; auto-generates on create and/or update |
| 🔗 **Clickable link preview** | Displays full URL as a clickable link in preview mode |
| ✏️ **Inline editing** | Click ✏️ to edit; `Enter` confirms, `Escape` cancels |
| 🎨 **Micromustache template** | Source field defined via `{{ name }}`, `{{ title }}`, etc. |
| 📐 **Dynamic prefix/suffix** | `/`, `https://site.com/`, `.html` — supports template variables |
| 🔄 **"Generate URL" button** | Force full regeneration including hierarchy resolution |
| 🔒 **Circular reference guard** | Detects and prevents infinite parent loops |
| 🆙 **Directus 11.x compatible** | Built for `host: ^11.0.0` |

---

## Installation

### Via npm

```bash
npm install @grupo-jpp/directus-extension-permalink-generator
```

Then copy the `dist/` folder into your Directus extensions directory:

```
extensions/
└── interfaces/
    └── jpp-permalink-generator/
        └── index.js   ← dist/index.js
```

### Build from source

```bash
git clone https://github.com/grupo-jpp/directus-extension-permalink-generator.git
cd directus-extension-permalink-generator
npm install
npm run build
# Copy dist/ to your Directus extensions/interfaces/ folder
```

---

## Configuration

After installing, add the interface to any `string` field in your Directus collection. The following options are available:

| Option | Type | Default | Description |
|---|---|---|---|
| `template` | `string` | *(required)* | Micromustache template to generate the slug source. E.g. `{{ name }}` |
| `parentRelationField` | `string` | `''` | Field name of the M2O parent relation. Leave empty for flat slugs. |
| `prefix` | `string` | `/` | URL prefix. Supports template variables. E.g. `/` or `https://site.com/` |
| `suffix` | `string` | `''` | URL suffix. E.g. `/` or `.html` |
| `placeholder` | `string` | `''` | Placeholder text shown when the field is empty |
| `iconLeft` | `string` | — | Directus icon name displayed on the left |
| `update` | `string[]` | `['create']` | When to auto-generate: `'create'`, `'update'`, or both |

---

## Usage Examples

### Flat slug (no parent hierarchy)

**Configuration:**
- Template: `{{ name }}`
- Prefix: `/`
- Parent Relation Field: *(empty)*

**Result:**

| Input `name` | Generated permalink |
|---|---|
| `Vestuário` | `/vestuario` |
| `Bicicletas Elétricas` | `/bicicletas-eletricas` |
| `Café com Leite` | `/cafe-com-leite` |
| `ñoño` | `/nono` |
| `über cool` | `/uber-cool` |

---

### Hierarchical slug (with parent resolution)

**Configuration:**
- Template: `{{ name }}`
- Prefix: `/`
- Parent Relation Field: `parent`

**Collection structure:**

```
Bicicletas (id: 1, parent: null)
└── MTB (id: 2, parent: 1)
    └── 29er (id: 3, parent: 2)
```

**Result:**

| Item | Generated permalink |
|---|---|
| `Bicicletas` | `/bicicletas` |
| `MTB` | `/bicicletas/mtb` |
| `29er` | `/bicicletas/mtb/29er` |

---

### Custom prefix and suffix

**Configuration:**
- Prefix: `https://shop.example.com/`
- Suffix: `/`

**Result:** `https://shop.example.com/bicicletas/mtb/29er/`

---

## Accent Handling

This extension uses `@sindresorhus/slugify` which properly normalizes Unicode characters before removing diacritics:

| Input | Output | Notes |
|---|---|---|
| `vestuário` | `vestuario` | ✅ `á` → `a` (NOT removed) |
| `bicicletas elétricas` | `bicicletas-eletricas` | ✅ |
| `café com leite` | `cafe-com-leite` | ✅ |
| `ñoño` | `nono` | ✅ `ñ` → `n` |
| `über cool` | `uber-cool` | ✅ `ü` → `u` |
| `São Paulo` | `sao-paulo` | ✅ |

> ⚠️ The original `letrthang/directus-cms-permalink-generator` used a regex `[^\w\-]+` which **removed** accented characters instead of converting them. This extension fixes that bug.

---

## Keyboard Shortcuts (Inline Edit Mode)

| Key | Action |
|---|---|
| `Enter` | Confirm edit |
| `Escape` | Cancel and restore previous value |

---

## Development

```bash
npm install
npm run dev   # watch mode with sourcemaps
npm run build # production build
```

---

## Credits

This extension is a merge of two excellent open-source projects:

- **[letrthang/directus-cms-permalink-generator](https://github.com/letrthang/directus-cms-permalink-generator)** — hierarchical parent resolution logic
- **[dimitrov-adrian/directus-extension-wpslug-interface](https://github.com/dimitrov-adrian/directus-extension-wpslug-interface)** — WordPress-style UX, auto-generation, inline editing, micromustache, `@sindresorhus/slugify`

---

## License

[MIT](./LICENSE) © Grupo JPP