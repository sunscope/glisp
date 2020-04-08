import {
	MalVal,
	MalList,
	isList,
	MalFunc,
	MalAtom,
	isVector,
	createMalVector,
	cloneAST
} from './types'
import printExp, {printer} from './printer'
import readStr from './reader'

function _error(e: string) {
	throw new Error(e)
}

// String functions
function slurp(url: string) {
	const req = new XMLHttpRequest()
	req.open('GET', url, false)
	req.send()
	if (req.status !== 200) {
		_error(`Failed to slurp file: ${url}`)
	}
	return req.responseText
}

export const coreNS = new Map<string, any>([
	[
		'throw',
		(a: any) => {
			throw a
		}
	],

	['nil?', (a: MalVal) => a === null],
	['true?', (a: MalVal) => a === true],
	['false?', (a: MalVal) => a === false],
	['number?', (a: MalVal) => typeof a === 'number'],
	['string?', (a: MalVal) => typeof a === 'string'],
	['symbol', (a: string) => Symbol.for(a)],
	['symbol?', (a: MalVal) => typeof a === 'symbol'],
	['fn?', (a: MalVal) => typeof a === 'function' && !(a as MalFunc).ismacro],
	[
		'[macro?',
		(a: MalVal) => typeof a === 'function' && !!(a as MalFunc).ismacro
	],

	// Compare
	['=', (a: MalVal, b: MalVal) => a === b],
	['<', (a: number, b: number) => a < b],
	['<=', (a: number, b: number) => a <= b],
	['>', (a: number, b: number) => a > b],
	['>=', (a: number, b: number) => a >= b],

	['or', (...a: MalList) => a.reduce((x, y) => x || y, false)],
	['and', (...a: MalList) => a.reduce((x, y) => x && y, true)],

	// Calculus
	['+', (...a: Array<number>) => a.reduce((x, y) => x + y, 0)],
	['-', (...a: Array<number>) => a.reduce((x, y) => x - y, 0)],
	['*', (...args: Array<number>) => args.reduce((a, b) => a * b, 1)],
	['/', (i: number, ...rest: Array<number>) => rest.reduce((a, b) => a / b, i)],

	['list', (...a: MalList) => a],
	['list?', isList],
	['vector', (...a: MalList) => createMalVector(a)],
	['vector?', isVector],

	[
		'nth',
		(a: MalList, b: number) =>
			b < a.length ? a[b] : _error('nth: index out of range')
	],
	['first', (a: MalList) => (a !== null && a.length > 0 ? a[0] : null)],
	['rest', (a: MalList) => (a === null ? [] : Array.from(a.slice(1)))],
	[
		'last',
		(a: MalList) => (a !== null && a.length > 0 ? a[a.length - 1] : null)
	],

	['empty?', (l: MalList) => l.length === 0],
	['count', (a: MalList) => (a === null ? 0 : a.length)],
	[
		'apply',
		(f: MalFunc, ...a: MalList) => f(...a.slice(0, -1).concat(a[a.length - 1]))
	],

	['str', (...a: MalList) => a.map(e => printExp(e, false)).join('')],
	[
		'prn',
		(...a: MalList) => {
			printer.println(...a.map(e => printExp(e, true)))
			return null
		}
	],
	['read-string', readStr],
	['slurp', slurp],

	['cons', (a: MalVal, b: MalVal) => [a].concat(b)],
	[
		'concat',
		(...args: MalList) => args.reduce((x: MalList, y) => x.concat(y), [])
	],

	['meta', (a: MalVal) => (a as any)?.meta || null],
	[
		'with-meta',
		(a: MalVal, m: any) => {
			const c = cloneAST(a)
			;(c as any).meta = m
			return c
		}
	],
	['atom', (a: MalVal) => new MalAtom(a)],
	['atom?', (a: MalVal) => a instanceof MalAtom],
	['deref', (atm: MalAtom) => atm.val],
	['reset!', (atm: MalAtom, a: MalVal) => (atm.val = a)],
	[
		'swap!',
		(atm: MalAtom, fn: MalFunc, ...args: any) =>
			(atm.val = fn(...[atm.val].concat(args)))
	],

	// Conditionals
	[
		'range',
		(...args: number[]) => {
			let start = 0,
				end = 0,
				step = 1

			if (args.length === 1) {
				;[end] = args
			} else if (args.length === 2) {
				;[start, end] = args
			} else {
				;[start, end, step] = args
			}

			const arr = []

			for (let i = start; i < end; i += step) {
				arr.push(i)
			}

			return arr
		}
	]
])

// Expose Math
Object.getOwnPropertyNames(Math).forEach(k => coreNS.set(k, (Math as any)[k]))
