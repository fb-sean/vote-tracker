export default function Isset<T>(value: T | undefined | null): value is T {
    return value !== undefined && value !== null;
}