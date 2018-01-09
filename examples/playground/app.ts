import { RequestContext } from '../../lib/request-context';

export namespace entrypoints {
    /// <summary> Entrypoint: sort </summary>
    export function sort(context: RequestContext, input: number[]): number[] {
        let comparator = context.get("comparator");
        return input.sort(comparator);
    }
}

/// <summary> Default comparator </summary>
export function defaultComparator(a: number, b: number): number {
    return a - b;
}