/* eslint-disable @typescript-eslint/no-use-before-define */

import {
	MalVal,
	MalFunc,
	createMalFunc,
	isMalFunc,
	cloneAST,
	isKeyword
} from './types'

import readStr from './reader'
import printExp, {printer} from './printer'
import Env from './env'
import {declareAllNamespaces} from './ns'

export class LispError extends Error {}

// read
export const READ = (str: string) => readStr(str)

// eval
const isPair = (x: MalVal) => Array.isArray(x) && x.length > 0

function quasiquote(ast: MalVal): MalVal {
	const _ast = ast as any

	if (!isPair(ast)) {
		return [Symbol.for('quote'), ast]
	} else if (_ast[0] === Symbol.for('unquote')) {
		return _ast[1]
	} else if (isPair(_ast[0]) && _ast[0][0] === Symbol.for('splice-unquote')) {
		return [Symbol.for('concat'), _ast[0][1], quasiquote(_ast.slice(1))]
	} else {
		return [Symbol.for('cons'), quasiquote(_ast[0]), quasiquote(_ast.slice(1))]
	}
}

function macroexpand(ast: MalVal = null, env: Env) {
	while (Array.isArray(ast) && typeof ast[0] === 'symbol' && env.find(ast[0])) {
		const fn = env.get(ast[0]) as MalFunc
		if (!fn.ismacro) {
			break
		}
		ast = fn(...ast.slice(1))
	}

	return ast
}

const evalAst = (ast: MalVal, env: Env) => {
	if (typeof ast === 'symbol') {
		return env.get(ast)
	} else if (Array.isArray(ast)) {
		return ast.map(x => EVAL(x, env))
	} else if (ast instanceof Map) {
		const hm = new Map()
		ast.forEach((v, k) => hm.set(EVAL(k, env), EVAL(v, env)))
		return hm
	} else {
		return ast
	}
}

const S = Symbol.for

export function EVAL(ast: MalVal, env: Env): MalVal {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		if (!Array.isArray(ast)) {
			return evalAst(ast, env)
		}

		ast = macroexpand(ast, env)

		if (!Array.isArray(ast)) {
			return evalAst(ast, env)
		}

		if (ast.length === 0) {
			return ast
		}

		// Apply list
		const [a0, a1, a2, a3] = ast

		// Special Forms
		switch (typeof a0 === 'symbol' ? Symbol.keyFor(a0) : Symbol(':default')) {
			case 'def':
				return env.set(a1 as symbol, EVAL(a2, env))
			case 'let': {
				const letEnv = new Env(env)
				const lst = a1 as MalVal[]
				for (let i = 0; i < lst.length; i += 2) {
					letEnv.set(lst[i] as symbol, EVAL(lst[i + 1], letEnv))
				}
				env = letEnv
				ast = ast.length === 3 ? a2 : [S('do'), ...ast.slice(2)]
				break // continue TCO loop
			}
			case 'quote':
				return a1
			case 'quasiquote':
				ast = quasiquote(a1)
				break // continue TCO loop
			case 'defmacro': {
				const fnast = [
					S('fn'),
					a2,
					ast.length === 4 ? a3 : [S('do'), ...ast.slice(3)]
				]
				const fn = cloneAST(EVAL(fnast, env)) as MalFunc
				fn.ismacro = true
				return env.set(a1 as symbol, fn)
			}
			case 'macroexpand':
				return macroexpand(a1, env)
			case 'try':
				try {
					return EVAL(a1, env)
				} catch (exc) {
					let err = exc
					if (a2 && Array.isArray(a2) && a2[0] === S('catch')) {
						if (exc instanceof Error) {
							err = exc.message
						}
						return EVAL(a2[2], new Env(env, [a2[1] as symbol], [err]))
					} else {
						throw err
					}
				}
			case 'do':
				evalAst(ast.slice(1, -1), env)
				ast = ast[ast.length - 1]
				break // continue TCO loop
			case 'if': {
				const cond = EVAL(a1, env)
				if (cond) {
					ast = a2
				} else {
					ast = typeof a3 !== 'undefined' ? a3 : null
				}
				break // continue TCO loop
			}
			case 'fn':
				return createMalFunc(
					(...args) => EVAL(a2, new Env(env, a1 as symbol[], args)),
					a2,
					env,
					a1 as symbol[]
				)
			case 'env-chain': {
				let _env: Env | null = env
				const envs = []

				do {
					envs.push(_env)
					_env = _env.outer
				} while (_env)

				ast = [Symbol.for('println'), envs.map(e => e.name).join(' <- ')]
				break // continue TCO loop
			}
			case 'which-env': {
				let _env: Env | null = env
				const envs = []

				do {
					envs.push(_env)
					_env = _env.outer
				} while (_env)

				ast = [
					Symbol.for('println'),
					envs
						.filter(e => e.hasOwn(a1 as string))
						.map(e => e.name)
						.join(' <- ') || 'not defined'
				]
				break
			}
			default: {
				// Apply Function
				const [_fn, ...args] = evalAst(ast, env) as MalVal[]

				const fn = _fn as MalFunc

				if (isMalFunc(fn)) {
					env = new Env(fn.env, fn.params, args)
					ast = fn.ast
					break // continue TCO loop
				} else if (typeof fn === 'function') {
					return fn(...args)
				} else {
					let typename = ''

					if (isKeyword(fn)) {
						typename = 'Keyword '
					} else if (Array.isArray(fn)) {
						typename = 'List '
					}
					throw new LispError(
						`[EVAL] ${typename} ${PRINT(
							fn
						)} is not a function. First element of list always should be a function.`
					)
				}
			}
		}
	}
}

// print
export const PRINT = (ast: MalVal) => {
	return printExp(ast, true)
}

// Initialize root Env
export const replEnv: Env = new Env()
replEnv.name = 'repl'

// eval(0) should be declared before everything
replEnv.set('eval', (ast: MalVal) => {
	return EVAL(ast, replEnv)
})

// Namespace decleration
declareAllNamespaces(replEnv)

// Root REPL
export const REP = (str: string, env: Env = replEnv) => {
	try {
		PRINT(EVAL(READ(str), env))
	} catch (err) {
		printer.error(err)
	}
}

// Load core library

/* eslint-disable no-useless-escape */
REP(`(def __filename__ (js-eval "new URL('.', document.baseURI).href"))`)
REP(`(def load-file-force
  (fn (path)
		(let (url (js-eval (format "new URL('%s', '%s')" path __filename__)))
      (eval (read-string
             (format "(do (def __filename__ \\"%s\\") %s \n nil)"
                     url
                     (slurp url)))))))`)

REP('(load-file-force "./lib/core.cljs")')