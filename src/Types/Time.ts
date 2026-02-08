export enum Time {
    Minute = 60,
    Hour = 60 * Time.Minute,
    Day = 24 * Time.Hour,
    Week = 7 * Time.Day,
    Month = 30 * Time.Day,
    Year = 365 * Time.Day
}