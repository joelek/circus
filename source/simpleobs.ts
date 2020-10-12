export type Observer<A, B> = (value: A) => B;

export type Observable<A> = <B>(observer: Observer<A, B>) => Observable<B>;

export class ObservableClass<A> {
	private state: A;
	private observers: Array<Observer<A, any>>;

	constructor(state: A) {
		this.state = state;
		this.observers = new Array<Observer<A, any>>();
	}

	addObserver<B>(observer: Observer<A, B>): Observable<B> {
		let observable = new ObservableClass<B>(observer(this.state));
		this.observers.push((state) => {
			observable.updateState(observer(state));
		});
		return observable.addObserver.bind(observable);
	}

	getState(): A {
		return this.state;
	}

	updateState(state: A): void {
		if (state === this.state) {
			return;
		}
		this.state = state;
		for (let observer of this.observers) {
			observer(this.state);
		}
	}
}

type TupleOf<A extends any[]> = [...A];
export type ObservableClassTuple<A extends TupleOf<any>> = {
	[B in keyof A]: ObservableClass<A[B]>;
};

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
	onappend?(state: A): void,
	onsplice?(state: A, index: number): void,
	onupdate?(state: Array<A>): void
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
		observer.onupdate?.(this.state);
	}

	compute<B>(observer: Observer<Array<A>, B>): Observable<B> {
		let observable = new ObservableClass<B>(observer(this.state));
		this.observers.push({
			onupdate(state) {
				observable.updateState(observer(state));
			}
		});
		return observable.addObserver.bind(observable);
	}

	getState(): Array<A> {
		return this.state;
	}

	append(state: A): void {
		this.state.push(state);
		for (let observer of this.observers) {
			observer.onappend?.(state);
			observer.onupdate?.(this.state);
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
			observer.onupdate?.(this.state);
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
