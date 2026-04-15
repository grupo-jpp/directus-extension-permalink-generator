import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'jpp-permalink-generator',
	name: 'Permalink Generator',
	icon: 'link',
	description: 'Hierarchical permalink generator with accent-safe slugify, parent chain resolution, inline editing, and live preview',
	component: InterfaceComponent,
	types: ['string'],
	options: ({ collection }) => [
		{
			field: 'template',
			type: 'string',
			name: 'Template',
			meta: {
				width: 'full',
				interface: 'system-display-template',
				required: true,
				options: {
					collectionName: collection,
					font: 'monospace',
					placeholder: '{{ name }}',
				},
			},
		},
		{
			field: 'parentRelationField',
			name: 'Parent Relation Field',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
				options: {
					placeholder: 'parent (leave empty for flat slug)',
				},
			},
			schema: { default_value: '' },
		},
		{
			field: 'prefix',
			type: 'string',
			name: 'Prefix',
			meta: {
				width: 'half',
				interface: 'system-display-template',
				options: {
					collectionName: collection,
					font: 'monospace',
					placeholder: '/',
				},
			},
			schema: { default_value: '/' },
		},
		{
			field: 'suffix',
			type: 'string',
			name: 'Suffix',
			meta: {
				width: 'half',
				interface: 'system-display-template',
				options: {
					collectionName: collection,
					font: 'monospace',
					placeholder: '',
				},
			},
			schema: { default_value: '' },
		},
		{
			field: 'placeholder',
			name: 'Placeholder',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder: 'Enter a placeholder',
				},
			},
		},
		{
			field: 'iconLeft',
			name: 'Icon Left',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'select-icon',
			},
		},
		{
			field: 'update',
			name: 'Auto Generate',
			type: 'json',
			meta: {
				width: 'half',
				interface: 'select-multiple-checkbox',
				options: {
					choices: [
						{ text: 'On Create', value: 'create' },
						{ text: 'On Update', value: 'update' },
					],
				},
			},
			schema: { default_value: ['create'] },
		},
	],
});
