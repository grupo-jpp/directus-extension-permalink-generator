<script setup lang="ts">
import slugify from '@sindresorhus/slugify';
import { render } from 'micromustache';
import { computed, inject, ref, watch } from 'vue';

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
		placeholder: '',
		iconLeft: undefined,
		template: '',
		parentRelationField: '',
		prefix: '/',
		suffix: '',
		update: () => ['create'],
		primaryKey: '+',
		collection: '',
		field: '',
	},
);

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

// ─── Injected Directus context ───────────────────────────────────────────────

const api = inject<any>('api');
const values = inject<any>('values');

// ─── State ───────────────────────────────────────────────────────────────────

const isEditing = ref(false);
const isTouched = ref(false);
const isLoading = ref(false);
const cachedValueBeforeEdit = ref<string | null>(null);

// Maximum parent chain depth to prevent runaway recursion
const MAX_DEPTH = 10;

// ─── Slugify helper ──────────────────────────────────────────────────────────

function transform(value: string): string {
	return slugify(value, { separator: '-', preserveTrailingDash: true });
}

// ─── Template rendering ───────────────────────────────────────────────────────

function renderTemplate(template: string, scope: Record<string, unknown>): string {
	if (!template) return '';
	try {
		return render(template, scope);
	} catch {
		return '';
	}
}

// ─── Current slug from template ───────────────────────────────────────────────

const currentSlug = computed<string>(() => {
	const scope = values?.value ?? {};
	const raw = renderTemplate(props.template ?? '', scope);
	return transform(raw);
});

// ─── Rendered prefix / suffix ─────────────────────────────────────────────────

const renderedPrefix = computed<string>(() => {
	const scope = values?.value ?? {};
	return renderTemplate(props.prefix ?? '/', scope);
});

const renderedSuffix = computed<string>(() => {
	const scope = values?.value ?? {};
	return renderTemplate(props.suffix ?? '', scope);
});

// ─── Hierarchical path building ───────────────────────────────────────────────

async function buildPath(
	pageId: string | number,
	visitedIds: Set<string | number> = new Set(),
	depth = 0,
): Promise<string[]> {
	if (!pageId || pageId === '+') return [];
	if (depth >= MAX_DEPTH) return [];
	if (visitedIds.has(pageId)) return []; // circular reference guard

	visitedIds.add(pageId);

	const parentField = props.parentRelationField;
	if (!parentField) return [];

	try {
		const response = await api.get(`/items/${props.collection}/${pageId}`, {
			params: { fields: ['id', parentField].join(',') },
		});

		const page = response?.data?.data;
		if (!page) return [];

		// Derive slug from the remote item: we try a "slug" field first, fall
		// back to rendering the template with the remote item's data.
		const remoteSlug = transform(renderTemplate(props.template ?? '', page));

		const parentId = page[parentField];
		if (parentId && parentId !== pageId) {
			const parentPath = await buildPath(parentId, visitedIds, depth + 1);
			return [...parentPath, remoteSlug];
		}
		return [remoteSlug];
	} catch {
		return [];
	}
}

async function buildFullPath(): Promise<string> {
	const parentField = props.parentRelationField;

	// If no parent relation is configured, use flat slug
	if (!parentField) {
		return currentSlug.value;
	}

	const currentValues = values?.value ?? {};
	const parentId = currentValues[parentField];

	// Self-reference guard
	if (parentId && parentId === props.primaryKey) {
		return currentSlug.value;
	}

	if (parentId) {
		const visited = new Set<string | number>();
		const parentPath = await buildPath(parentId, visited, 0);
		return [...parentPath, currentSlug.value].join('/');
	}

	return currentSlug.value;
}

// ─── Generate (full regeneration) ────────────────────────────────────────────

async function generate(): Promise<void> {
	if (isLoading.value) return;
	isLoading.value = true;
	try {
		const path = await buildFullPath();
		emit('input', path || null);
		isTouched.value = false;
	} finally {
		isLoading.value = false;
	}
}

// ─── Presented link (for preview) ────────────────────────────────────────────

const presentedLink = computed<string>(() => {
	const slug = props.value ?? '';
	return `${renderedPrefix.value}${slug}${renderedSuffix.value}`;
});

// ─── isDiffer: stale check (slug template changed vs stored value) ─────────────

const expectedFlatSlug = computed<string>(() => currentSlug.value);

const isDiffer = computed<boolean>(() => {
	if (!props.value) return !!expectedFlatSlug.value;
	// Only compare the last segment (own slug), not the full hierarchy
	const stored = props.value.split('/').pop() ?? '';
	return stored !== expectedFlatSlug.value;
});

// ─── Auto-generation watch ────────────────────────────────────────────────────

watch(
	() => values?.value,
	async () => {
		if (isTouched.value) return;

		const isCreate = props.primaryKey === '+' || props.primaryKey === undefined;
		const shouldAutoGenerate =
			(isCreate && props.update?.includes('create')) ||
			(!isCreate && props.update?.includes('update'));

		if (!shouldAutoGenerate) return;

		await generate();
	},
	{ deep: true },
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
	isTouched.value = true;
	emit('input', transform(newValue) || null);
}

function onKeyPress(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		disableEdit();
	} else if (event.key === 'Escape') {
		emit('input', cachedValueBeforeEdit.value);
		disableEdit();
	}
}
</script>

<template>
	<!-- ── Editing mode ──────────────────────────────────────────────────────── -->
	<v-input
		v-if="isEditing && !disabled"
		:autofocus="true"
		:model-value="value"
		:placeholder="placeholder"
		:trim="true"
		:slug="true"
		slug-separator="-"
		@update:model-value="onChange"
		@blur="disableEdit"
		@keydown="onKeyPress"
	>
		<template v-if="iconLeft || renderedPrefix" #prepend>
			<v-icon v-if="iconLeft" :name="iconLeft" />
			<span v-if="renderedPrefix" class="prefixsuffix">{{ renderedPrefix }}</span>
		</template>
		<template v-if="renderedSuffix" #append>
			<span class="prefixsuffix">{{ renderedSuffix }}</span>
		</template>
	</v-input>

	<!-- ── Preview mode ──────────────────────────────────────────────────────── -->
	<div v-else class="link-preview-mode">
		<v-icon v-if="iconLeft" :name="iconLeft" class="icon-left" />

		<a
			v-if="value && renderedPrefix"
			:href="presentedLink"
			target="_blank"
			rel="noopener noreferrer"
			class="link"
		>{{ presentedLink }}</a>
		<span v-else class="link placeholder-text">{{ value ? presentedLink : placeholder }}</span>

		<!-- Edit button -->
		<v-button
			v-if="!disabled"
			x-small
			secondary
			icon
			class="action-button"
			:disabled="isLoading"
			@click="enableEdit"
		>
			<v-icon name="edit" />
		</v-button>

		<!-- Auto-generate button (stale slug detected) -->
		<v-button
			v-if="isDiffer && !isTouched && !disabled"
			x-small
			secondary
			icon
			class="action-button"
			:disabled="isLoading"
			@click="generate"
		>
			<v-icon name="auto_fix_high" />
		</v-button>

		<!-- Force generate / hierarchy button -->
		<v-button
			v-if="!disabled"
			x-small
			secondary
			class="action-button generate-btn"
			:loading="isLoading"
			@click="generate"
		>
			<v-icon name="refresh" small />
			Generate URL
		</v-button>
	</div>
</template>

<style scoped>
.link-preview-mode {
	display: flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
	min-height: var(--input-height);
	padding: 0 var(--input-padding);
	background-color: var(--background-subdued);
	border: var(--border-width) solid var(--border-normal);
	border-radius: var(--border-radius);
}

.icon-left {
	color: var(--foreground-subdued);
	flex-shrink: 0;
}

.link {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-family: var(--family-monospace);
	font-size: 14px;
	color: var(--primary);
	text-decoration: none;
}

.link:hover {
	text-decoration: underline;
}

.placeholder-text {
	color: var(--foreground-subdued);
}

.action-button {
	flex-shrink: 0;
}

.generate-btn {
	margin-left: auto;
}

.prefixsuffix {
	color: var(--foreground-subdued);
	font-family: var(--family-monospace);
	white-space: nowrap;
	user-select: none;
}
</style>
