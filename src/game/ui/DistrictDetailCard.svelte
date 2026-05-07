<script lang="ts">
	import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';
	import { getHexTileColorForSchool, toCssHexColor } from '../../shared/ui/buildingSchoolColors';
	import { orderedResourceEntries, resourceCode } from './cardFormatters';
	import Twemoji from './Twemoji.svelte';

	export let def: BuildingCatalogEntry;
	export let showNotch = true;

	function schoolDistrictLabel(school: string): string {
		return `${school.charAt(0).toUpperCase()}${school.slice(1)} district`;
	}

	function kindLabel(kind: BuildingCatalogEntry['kind']): string {
		return kind === 'army' ? 'Army' : 'Production';
	}

	$: iconBackground = toCssHexColor(getHexTileColorForSchool(def.school));
</script>

<div class="district-card ui-notched-card {showNotch ? 'ui-notched-card--notch-left' : ''}">
	<div class="district-card__header">
		<div class="district-card__icon" style="background: {iconBackground};">
			<img src={`assets/${def.assetPath}`} alt={def.name} />
		</div>
		<div class="district-card__titles">
			<h3>{def.name}</h3>
			<p>Tier {def.tier} {schoolDistrictLabel(def.school)}</p>
			<p>{kindLabel(def.kind)}</p>
		</div>
	</div>

	<div class="district-card__description">
		{#each orderedResourceEntries(def.productions) as [resource, amount] (`${resource}-${amount}`)}
			<p>Produces {amount} <Twemoji code={resourceCode(resource)} /> / <Twemoji code="231b" />.</p>
		{/each}
		{#if def.housedUnit}
			<p>Houses {def.housedUnit.name}.</p>
		{/if}
		<p>{def.description}</p>
	</div>
</div>

<style>
	.district-card {
		width: min(430px, 100%);
		max-width: 100%;
		box-sizing: border-box;
		padding: 14px;
	}

	.district-card__header {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}

	.district-card__icon {
		width: 74px;
		height: 74px;
		flex: none;
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.district-card__icon img {
		width: 70%;
		height: 70%;
		object-fit: contain;
	}

	.district-card__titles h3 {
		margin: 0;
		line-height: 1;
		font-weight: var(--font-weight-extrabold);
		font-size: 28px;
	}

	.district-card__titles p {
		margin: var(--space-xs) 0 0;
		font-size: var(--space-lg);
		line-height: 1.1;
	}

	.district-card__description {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.district-card__description p {
		margin: 0;
		font-size: var(--space-lg);
		line-height: 1.2;
	}

	@media (max-width: 860px) {
		.district-card {
			padding: 10px var(--space-md);
		}

		.district-card__titles h3 {
			font-size: 22px;
		}

		.district-card__titles p,
		.district-card__description p {
			font-size: 14px;
		}

		.district-card__icon {
			width: 58px;
			height: 58px;
		}
	}
</style>
