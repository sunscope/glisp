<template>
	<div class="MalInputAngle">
		<MalInputNumber
			class="MalInputAngle__input"
			:compact="true"
			:value="value"
			@input="onInput($event.value)"
			@select="$emit('select', $event)"
			:validator="validator"
		/>
		<InputRotery class="MalInputAngle__rotery" :value="evaluated" @input="onInput" />
	</div>
</template>

<script lang="ts">
import {
	defineComponent,
	PropType,
	computed,
	SetupContext
} from '@vue/composition-api'
import MalInputNumber from './MalInputNumber.vue'
import {InputRotery} from '@/components/inputs'
import {MalSeq, MalSymbol, MalVal, getEvaluated} from '@/mal/types'
import {reverseEval} from '@/mal/utils'
import {NonReactive, nonReactive} from '@/utils'

interface Props {
	value: NonReactive<number | MalSeq | MalSymbol>
	validator: (v: number) => number | null
}

export default defineComponent({
	name: 'MalInputAngle',
	components: {MalInputNumber, InputRotery},
	props: {
		value: {
			required: true,
			validator: x => x instanceof NonReactive
		},
		validator: {
			required: false
		}
	},
	setup(props: Props, context: SetupContext) {
		const evaluated = computed(() => {
			return getEvaluated(props.value.value) as number
		})

		function onInput(value: MalVal) {
			let newExp = value
			if (typeof newExp === 'number') {
				// Executes backward evalution
				newExp = reverseEval(newExp, props.value.value)
			}
			context.emit('input', nonReactive(newExp))
		}

		return {
			evaluated,
			onInput
		}
	}
})
</script>

<style lang="stylus">
@import '../style/common.styl'

.MalInputAngle
	display flex
	align-items center
	line-height $input-height

	&__input
		margin-right 0.5em

	&__rotery
		margin-left 0.5rem
</style>
