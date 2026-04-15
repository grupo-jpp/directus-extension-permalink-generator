<template>
  <v-input
    v-if="isEditing && !disabled"
    :autofocus="true"
    :model-value="value"
    :placeholder="placeholder"
    :trim="trim"
    :slug="true"
    slug-separator="-"
    @update:model-value="onChange"
    @blur="disableEdit"
    @keydown="onKeyPress"
  >
    <template v-if="iconLeft || renderedPrefix" #prepend>
      <v-icon v-if="iconLeft" :name="iconLeft" />
      <span class="prefix-suffix">{{ renderedPrefix }}</span>
    </template>
    <template v-if="renderedSuffix" #append>
      <span class="prefix-suffix">{{ renderedSuffix }}</span>
    </template>
  </v-input>

  <div v-else class="link-preview-mode">
    <v-icon v-if="iconLeft" :name="iconLeft" class="icon-left" />

    <a
      v-if="value && prefix"
      target="_blank"
      rel="noopener noreferrer"
      class="link"
      :href="presentedLink"
      >{{ presentedLink }}</a
    >
    <span v-else class="link" @click="!disabled && enableEdit()">{{
      presentedLink
    }}</span>

    <v-button
      v-if="!disabled"
      v-tooltip="'Edit'"
      x-small
      secondary
      icon
      class="action-button"
      @click="enableEdit"
    >
      <v-icon name="edit" />
    </v-button>

    <v-button
      v-if="isDiffer && !isTouched && !disabled"
      v-tooltip="'Slug changed, click to update'"
      x-small
      secondary
      icon
      class="action-button"
      @click="setByCurrentState"
    >
      <v-icon name="auto_fix_high" />
    </v-button>

    <v-button
      v-if="parentRelationField && !disabled"
      v-tooltip="'Regenerate full path'"
      x-small
      secondary
      icon
      class="action-button"
      :loading="isLoading"
      @click="generateFullPath"
    >
      <v-icon name="refresh" />
    </v-button>
  </div>
</template>

<script setup lang="ts">
import slugify from "@sindresorhus/slugify";
import { render } from "micromustache";
import { computed, inject, nextTick, ref, watch, type Ref } from "vue";

interface DirectusApi {
  get(
    url: string,
    config?: { params?: Record<string, unknown> }
  ): Promise<{ data: { data: unknown } }>;
}

// ─── Props ──────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    value: string | null;
    disabled?: boolean;
    placeholder?: string;
    iconLeft?: string;
    template?: string;
    parentRelationField?: string;
    prefix?: string;
    suffix?: string;
    update?: string[];
    primaryKey?: string | number;
    collection?: string;
    field?: string;
  }>(),
  {
    disabled: false,
    placeholder: "",
    iconLeft: undefined,
    template: "",
    parentRelationField: "",
    prefix: "",
    suffix: "",
    update: () => ["create"],
    primaryKey: "+",
    collection: "",
    field: "",
  }
);

const emit = defineEmits<{
  (e: "input", value: string | null): void;
}>();

// ─── Injected Directus context ───────────────────────────────────────────────

const api = inject<DirectusApi>("api");
const values = inject<Ref<Record<string, unknown>>>("values", ref({}));

// ─── State ───────────────────────────────────────────────────────────────────

const isEditing = ref(false);
const isTouched = ref(false);
const isLoading = ref(false);
const cachedValueBeforeEdit = ref<string | null>(null);
const trim = ref(true);

const MAX_DEPTH = 10;

// Debounce timer for auto-generation with hierarchy
let autoGenerateTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Slugify helper ──────────────────────────────────────────────────────────

function transform(value: string): string {
  return slugify(value, { separator: "-", preserveTrailingDash: true });
}

// ─── Template rendering ───────────────────────────────────────────────────────

function renderTemplate(
  template: string,
  scope: Record<string, unknown>
): string {
  if (!template) return "";
  try {
    return render(template, scope);
  } catch {
    return "";
  }
}

// ─── Computed values ──────────────────────────────────────────────────────────

const renderedPrefix = computed(() =>
  renderTemplate(props.prefix || "", values.value)
);
const renderedSuffix = computed(() =>
  renderTemplate(props.suffix || "", values.value)
);

const presentedLink = computed(() => {
  const slug = props.value || props.placeholder || props.field || "";
  return renderedPrefix.value + slug + renderedSuffix.value;
});

const isDiffer = computed(() => {
  const transformed = transform(renderTemplate(props.template, values.value));
  if (!transformed && !props.value) return false;
  if (transformed === (props.value || "")) return false;
  // For hierarchical slugs, compare only the last segment
  const lastSegment = (props.value || "").split("/").pop() ?? "";
  return transformed !== lastSegment;
});

// ─── Deduplication: check for existing slugs ─────────────────────────────────

async function findUniqueSlug(slug: string): Promise<string> {
  if (!api || !props.collection || !props.field || !slug) return slug;

  try {
    // Search for items that match this slug or slug-N pattern
    const filter: Record<string, unknown> = {
      [props.field]: { _eq: slug },
    };

    // Exclude current item if editing
    if (props.primaryKey && props.primaryKey !== "+") {
      filter["id"] = { _neq: props.primaryKey };
    }

    const response = await api.get(`/items/${props.collection}`, {
      params: {
        filter,
        fields: ["id", props.field],
        limit: 1,
      },
    });

    const data = response?.data?.data;
    const exists = Array.isArray(data) && data.length > 0;

    if (!exists) return slug;

    // Slug exists, find a unique suffix
    // Search for all slugs matching the pattern slug-N
    const patternFilter: Record<string, unknown> = {
      [props.field]: { _starts_with: slug },
    };

    if (props.primaryKey && props.primaryKey !== "+") {
      patternFilter["id"] = { _neq: props.primaryKey };
    }

    const allResponse = await api.get(`/items/${props.collection}`, {
      params: {
        filter: patternFilter,
        fields: [props.field],
        limit: -1,
      },
    });

    const allData = allResponse?.data?.data;
    const existingSlugs = new Set<string>();

    if (Array.isArray(allData)) {
      for (const item of allData) {
        const val = item[props.field];
        if (typeof val === "string") existingSlugs.add(val);
      }
    }

    // Find the next available number
    let counter = 1;
    let candidate = `${slug}-${counter}`;
    while (existingSlugs.has(candidate)) {
      counter++;
      candidate = `${slug}-${counter}`;
    }

    return candidate;
  } catch {
    // If the check fails, return the original slug
    return slug;
  }
}

// ─── Hierarchical path building ───────────────────────────────────────────────

async function buildParentPath(
  pageId: string | number,
  visitedIds: Set<string | number> = new Set(),
  depth = 0
): Promise<string[]> {
  if (!pageId || pageId === "+") return [];
  if (depth >= MAX_DEPTH) return [];
  if (visitedIds.has(pageId)) return [];

  visitedIds.add(pageId);

  const parentField = props.parentRelationField;
  if (!parentField || !api || !props.collection) return [];

  try {
    const response = await api.get(`/items/${props.collection}/${pageId}`, {
      params: { fields: "*" },
    });

    const page = response?.data?.data as Record<string, unknown> | undefined;
    if (!page) return [];

    const remoteSlug = transform(renderTemplate(props.template ?? "", page));
    const parentId = page[parentField] as string | number | undefined;

    if (parentId && parentId !== pageId) {
      const parentPath = await buildParentPath(parentId, visitedIds, depth + 1);
      return [...parentPath, remoteSlug];
    }
    return [remoteSlug];
  } catch {
    return [];
  }
}

async function buildFullPath(): Promise<string> {
  const currentSlug = transform(
    renderTemplate(props.template ?? "", values.value)
  );
  const parentField = props.parentRelationField;

  if (!parentField) return currentSlug;

  const parentId = values.value[parentField] as string | number | undefined;

  // Self-reference guard
  if (parentId && parentId === props.primaryKey) return currentSlug;

  if (parentId) {
    const visited = new Set<string | number>();
    const parentPath = await buildParentPath(parentId, visited, 0);
    return [...parentPath, currentSlug].join("/");
  }

  return currentSlug;
}

// ─── Emit helpers ─────────────────────────────────────────────────────────────

function emitFlat(scope: Record<string, unknown>): void {
  const newValue = transform(renderTemplate(props.template, scope));
  if (newValue === (props.value || "")) return;
  emit("input", newValue || null);
}

async function emitWithDedup(slug: string): Promise<void> {
  const unique = await findUniqueSlug(slug);
  if (unique !== (props.value || "")) {
    emit("input", unique || null);
  }
}

async function generateFullPath(): Promise<void> {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    const path = await buildFullPath();
    // Deduplicate the full path
    const unique = await findUniqueSlug(path);
    if (unique !== (props.value || "")) {
      emit("input", unique || null);
    }
    isTouched.value = false;
  } finally {
    isLoading.value = false;
  }
}

async function autoGenerateWithHierarchy(): Promise<void> {
  if (isEditing.value || isTouched.value) return;

  const isCreate = props.primaryKey === "+";
  if (isCreate && !props.update?.includes("create")) return;
  if (!isCreate && !props.update?.includes("update")) return;

  // Self-update guard
  if (props.field) {
    const fieldValue = values.value[props.field];
    if (fieldValue && (fieldValue || "") !== (props.value || "")) return;
  }

  try {
    const path = await buildFullPath();
    if (!path) return;

    // Only deduplicate on create
    if (isCreate) {
      await emitWithDedup(path);
    } else {
      if (path !== (props.value || "")) {
        emit("input", path || null);
      }
    }
  } catch {
    // Fallback to flat slug if hierarchy fails
    emitFlat(values.value);
  }
}

function setByCurrentState(): void {
  isTouched.value = false;
  if (props.parentRelationField) {
    generateFullPath();
  } else {
    const newValue = transform(renderTemplate(props.template, values.value));
    if (newValue) {
      // Deduplicate on manual trigger
      emitWithDedup(newValue);
    } else {
      emitFlat(values.value);
    }
  }
}

// ─── Auto-generation watch ────────────────────────────────────────────────────

watch(
  values,
  (currentValues: Record<string, unknown>) => {
    if (isEditing.value || isTouched.value) return;

    const isCreate = props.primaryKey === "+";
    if (isCreate && !props.update?.includes("create")) return;
    if (!isCreate && !props.update?.includes("update")) return;

    // Self-update guard
    if (props.field) {
      const fieldValue = currentValues[props.field];
      if (fieldValue && (fieldValue || "") !== (props.value || "")) return;
    }

    // Debounce: avoid rapid API calls during typing
    if (autoGenerateTimer) clearTimeout(autoGenerateTimer);

    if (props.parentRelationField) {
      // Hierarchical: debounce async generation
      autoGenerateTimer = setTimeout(() => {
        autoGenerateWithHierarchy();
      }, 500);
    } else {
      // Flat: emit synchronously (fast, no API call)
      emitFlat(currentValues);
    }
  },
  { deep: true }
);

// ─── Inline editing ───────────────────────────────────────────────────────────

function enableEdit(): void {
  if (props.disabled) return;
  cachedValueBeforeEdit.value = props.value;
  isEditing.value = true;
}

function disableEdit(): void {
  isEditing.value = false;
}

function onChange(newValue: string): void {
  if (props.disabled) return;
  if (props.value === newValue) return;

  isTouched.value = Boolean(newValue && newValue.trim());
  emit("input", transform(newValue || "") || null);
}

function onKeyPress(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    trim.value = false;
    isTouched.value = false;
    emit("input", cachedValueBeforeEdit.value);
    nextTick(() => {
      disableEdit();
      trim.value = true;
    });
  } else if (event.key === "Enter") {
    disableEdit();
  }
}
</script>

<style lang="css" scoped>
.prefix-suffix {
  color: var(--foreground-subdued);
}

.link-preview-mode {
  display: flex;
  align-items: center;
  min-height: var(--input-height);
}

.icon-left {
  margin-right: 8px;
}

.action-button {
  margin-left: 8px;
}

.link {
  color: var(--foreground-subdued);
  text-decoration: underline;
  word-break: break-word;
}

a.link {
  color: var(--primary);
}

a.link:focus-visible,
a.link:hover {
  color: var(--primary-75);
}
</style>
