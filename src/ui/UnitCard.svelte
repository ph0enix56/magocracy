<script lang="ts">
	import type { ArmyUnit } from '../shared/domain/gameViews';
	import type { UnitCatalogEntry } from '../shared/multiplayer/snapshots';
	import { inferUnitRangeLabel } from './cardFormatters';

	export let unit: ArmyUnit | UnitCatalogEntry;
	export let tier: number | null = null;
	export let showNotch = true;

	$: subtitle = [tier === null ? null : `Tier ${tier}`, `${inferUnitRangeLabel(unit)} ${unit.role}`]
		.filter((entry): entry is string => !!entry)
		.join(' ');
</script>

<div class="unit-card ui-notched-card {showNotch ? 'ui-notched-card--notch-left' : ''}">
	<div class="unit-card__header">
		<div class="unit-card__icon">
			<img src={`assets/${unit.assetPath}`} alt={unit.name} />
		</div>
		<div class="unit-card__titles">
			<h3>{unit.name}</h3>
			<p>{subtitle}</p>
		</div>
	</div>

	<div class="unit-card__stats">
		<div class="unit-card__stat"><span>❤️ HP:</span><strong>{unit.health}</strong></div>
		<div class="unit-card__stat"><span>🕓 Initiative:</span><strong>{unit.initiative}</strong></div>
		<div class="unit-card__stat"><span>🛡️ DR:</span><strong>{unit.drPercent}% + {unit.drFlat}</strong></div>
		<div class="unit-card__stat"><span>⚡ Action points:</span><strong>{unit.actionPoints}</strong></div>
	</div>

	<div class="unit-card__separator" aria-hidden="true"></div>

	<div class="unit-card__actions">
		{#each unit.actions as action, index (`${action.name}-${index}`)}
			<p>
				<span class="unit-card__action-name">{action.name}</span>
				{action.actionPointCost} ⚡: {action.targeting} in range {action.range}, {action.damage} DMG
			</p>
		{/each}
	</div>
</div>

<style>
	.unit-card {
		width: min(420px, 100%);
		max-width: 100%;
		padding: 12px 14px;
		box-sizing: border-box;
	}

	.unit-card__header {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.unit-card__icon {
		width: 76px;
		height: 76px;
		padding: 8px;
		border: 2px solid rgba(255, 255, 255, 0.9);
		border-radius: 4px;
		box-sizing: border-box;
		display: grid;
		place-items: center;
		flex: none;
	}

	.unit-card__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.unit-card__titles h3 {
		margin: 0;
		font-size: 28px;
		line-height: 1;
		font-weight: 800;
	}

	.unit-card__titles p {
		margin: 6px 0 0;
		font-size: 18px;
		line-height: 1.1;
	}

	.unit-card__stats {
		margin-top: 12px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px 18px;
		font-size: 16px;
	}

	.unit-card__stat {
		display: flex;
		justify-content: space-between;
		gap: 10px;
	}

	.unit-card__stat strong {
		font-weight: 500;
	}

	.unit-card__separator {
		height: 2px;
		margin: 8px 0;
		background: rgba(255, 255, 255, 0.82);
	}

	.unit-card__actions p {
		margin: 2px 0;
		font-size: 17px;
		line-height: 1.2;
	}

	.unit-card__action-name {
		font-weight: 800;
	}

	@media (max-width: 860px) {
		.unit-card {
			padding: 10px 12px;
		}

		.unit-card__icon {
			width: 62px;
			height: 62px;
		}

		.unit-card__titles h3 {
			font-size: 24px;
		}

		.unit-card__titles p,
		.unit-card__stats,
		.unit-card__actions p {
			font-size: 14px;
		}
	}
</style>
