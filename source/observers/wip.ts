export interface Observer<A> {
	(value: A): void
}

export interface Computer<A, B> {
	(state: A): B
}

export interface Observable<A> {
	addObserver(observer: Observer<A>): void,
	compute<B>(computer: Computer<A, B>): Observable<B>,
	getState(): A
}

class ConcreteObservable<A> implements Observable<A> {
	private observers: Array<Observer<A>>;
	private state: A;

	constructor(state: A) {
		this.observers = new Array<Observer<A>>();
		this.state = state;
	}

	addObserver(observer: Observer<A>): void {
		this.observers.push(observer);
		observer(this.state);
	}

	compute<B>(computer: Computer<A, B>): Observable<B> {
		let state = computer(this.state);
		let observable = new ConcreteObservable(state);
		this.addObserver((value) => {
			let state = computer(value);
			observable.setState(state);
		});
		return observable;
	}

	getState(): A {
		return this.state;
	}

	removeObserver(observer: Observer<A>): void {
		let index = this.observers.lastIndexOf(observer);
		if (index < 0) {
			throw "Expected a non-negative index!";
		}
		this.observers = this.observers.slice(index, 1);
	}

	setState(state: A): void {
		if (state === this.state) {
			return;
		}
		this.state = state;
		for (let observer of this.observers) {
			try {
				observer(this.state);
			} catch (error) {}
		}
	}
}

export type ObservableTuple<A extends [...any]> = {
	[B in keyof A]: Observable<A[B]>;
}

export const Tuple = {
	of<A extends [...any]>(...observables: ObservableTuple<[...A]>): Observable<[...A]> {
		let producer = () => {
			return observables.map(o => o.getState()) as [...A];
		};
		let result = new ConcreteObservable(producer());
		for (let observable of observables) {
			observable.addObserver(() => {
				result.setState(producer());
			});
		}
		return result;
	}
}

let one = new ConcreteObservable(true);
let two = new ConcreteObservable(true);
let tuple = Tuple.of(one, two);
let and = tuple.compute(([one, two]) => {
	return one && two;
});
and.addObserver(console.log);
one.setState(false);
one.setState(true);
