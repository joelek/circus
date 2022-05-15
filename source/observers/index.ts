export type Observer<A, B> = (value: A) => B;

export type Observable<A> = <B>(observer: Observer<A, B>) => Observable<B>;

export class ObservableClass<A> {
	private state: A;
	private observers: Array<{ observer: Observer<A, any>, alwaysNotify?: boolean }>;

	constructor(state: A) {
		this.state = state;
		this.observers = new Array<{ observer: Observer<A, any>, alwaysNotify?: boolean }>();
	}

	addObserver<B>(observer: Observer<A, B>, alwaysNotify?: boolean): Observable<B> {
		let observable = new ObservableClass<B>(observer(this.state));
		this.observers.push({
			observer: (state) => {
				observable.updateState(observer(state));
			},
			alwaysNotify
		});
		return observable.addObserver.bind(observable);
	}

	getState(): A {
		return this.state;
	}

	updateState(state: A): void {
		let didChange = state !== this.state;
		this.state = state;
		for (let observer of this.observers) {
			if (didChange || observer.alwaysNotify) {
				observer.observer(this.state);
			}
		}
	}
}

type TupleOf<A extends any[]> = [...A];
export type ObservableClassTuple<A extends TupleOf<any>> = {
	[B in keyof A]: ObservableClass<A[B]>;
};

// The computer is called once for every observable.
export function computed<A extends TupleOf<any>, B>(computer: (...values: TupleOf<A>) => B, ...observables: TupleOf<ObservableClassTuple<A>>): ObservableClass<B> {
	let observable = new ObservableClass(computer(...observables.map((observable) => observable.getState()) as [...A]));
	let updater = () => {
		observable.updateState(computer(...observables.map((observable) => observable.getState()) as [...A]));
	};
	for (let observable of observables) {
		observable.addObserver(updater);
	}
	return observable;
}

export interface ArrayObserver<A> {
	onappend?(state: A, index: number): void,
	onsplice?(state: A, index: number): void,
}

export class ArrayObservable<A> {
	private state: Array<A>;
	private observers: Array<ArrayObserver<A>>;

	constructor(state: Array<A>) {
		this.state = state;
		this.observers = new Array<ArrayObserver<A>>();
	}

	addObserver(observer: ArrayObserver<A>): void {
		this.observers.push(observer);
		for (let [index, value] of this.state.entries()) {
			observer.onappend?.(value, index);
		}
	}

	compute<B>(observer: Observer<Array<A>, B>): Observable<B> {
		let observable = new ObservableClass<B>(observer(this.state));
		this.observers.push({
			onappend: (state) => {
				observable.updateState(observer(this.state));
			},
			onsplice: (state, index) => {
				observable.updateState(observer(this.state));
			}
		});
		return observable.addObserver.bind(observable);
	}

	getState(): Array<A> {
		return [...this.state];
	}

	append(state: A): void {
		this.state.push(state);
		for (let observer of this.observers) {
			observer.onappend?.(state, this.state.length - 1);
		}
	}

	splice(index: number): void {
		if (index < 0 || index >= this.state.length) {
			throw `Expected an index of at most ${this.state.length}, got ${index}!`;
		}
		let state = this.state[index];
		this.state.splice(index, 1);
		for (let observer of this.observers) {
			observer.onsplice?.(state, index);
		}
	}

	update(state: A[]): void {
		for (let i = this.state.length - 1; i >= 0; i--) {
			this.splice(i);
		}
		for (let v of state) {
			this.append(v);
		}
	}
}
