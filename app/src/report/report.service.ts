import { Injectable } from '@nestjs/common';
import { AxiosResponse, AxiosError } from 'axios';

import { HttpRequestsService } from '../core/http-requests/http-requests.service';
import { TimerService } from '../timer/timer.service';
import { TimeService } from '../time/time.service';
import { FileService } from '../file/file.service';

@Injectable()
export class ReportService {
    constructor(
        private readonly httpRequestsService: HttpRequestsService,
        private readonly timerService: TimerService,
        private readonly timeService: TimeService,
        private readonly fileService: FileService
    ) {}

    getReportExport(
        teamId: string,
        userEmails: string[],
        projectNames: string[],
        startDate: string,
        endDate: string,
        timezoneOffset: number = 0,
        detailed: boolean = true
    ): Promise<{ path: string } | AxiosError> {
        const timerWhereStatement = {
            _or: [
                {
                    start_datetime: {
                        _gte: startDate,
                        _lte: endDate,
                    },
                },
                {
                    end_datetime: {
                        _gte: startDate,
                        _lte: endDate,
                    },
                },
                {
                    start_datetime: {
                        _lt: startDate,
                    },
                    end_datetime: {
                        _gt: endDate,
                    },
                },
            ],
            ...(userEmails.length && { user: { email: { _in: userEmails } } }),
            project: {
                team_id: {
                    _eq: teamId,
                },
                ...(projectNames.length && { name: { _in: projectNames } }),
            },
        };
        const variables = {
            timerWhere: timerWhereStatement,
        };

        const query = `query timer_v2($timerWhere: timer_v2_bool_exp){
            timer_v2(where: $timerWhere, order_by: {end_datetime: desc}) {
                issue
                start_datetime
                end_datetime
                project {
                    name
                }
                user {
                    email
                    username
                },
            }
        }`;

        return new Promise((resolve, reject) => {
            this.httpRequestsService.graphql(query, variables).subscribe(
                (res: AxiosResponse) => {
                    const reportData = detailed
                        ? this.prepareReportData(res.data, startDate, endDate, timezoneOffset)
                        : this.prepareGeneralReportData(res.data, startDate, endDate, timezoneOffset);
                    const reportPath = this.generateReport(reportData, timezoneOffset);

                    return resolve({ path: reportPath });
                },
                (error: AxiosError) => reject(error)
            );
        });
    }

    private prepareReportData(data: any, startDate: string, endDate: string, timezoneOffset: number): any[] {
        const { timer_v2: timerV2 } = data;
        const timerEntriesReport = {};
        for (let i = 0, timerV2Length = timerV2.length; i < timerV2Length; i++) {
            const timerEntry = timerV2[i];
            this.timerService.limitTimeEntryByStartEndDates(timerEntry, startDate, endDate);

            const { issue, start_datetime: startDatetime, end_datetime: endDatetime, project, user } = timerEntry;
            const { name: projectName } = project;
            const { email: userEmail, username } = user;

            const decodedIssue = issue ? decodeURI(issue).replace(/(\r\n|\n|\r)/g, '') : '';

            const re = /[\d*.,\d]+(\s*)+[a-z|\p{L}.]+(\s*)+\|+(\s*)/gu; // match pattern "2.5h | WOB-1252", "6,5 시간 | WOB-1252" when before issue located estimate from Jira
            const findEstimateFromJira = decodedIssue.match(re);

            const issueWithoutEstimateFromJira = Array.isArray(findEstimateFromJira)
                ? decodedIssue.replace(re, '')
                : decodedIssue;

            const uniqueTimeEntryKey = `${issueWithoutEstimateFromJira}-${projectName}-${userEmail}`;
            const previousDuration = timerEntriesReport[uniqueTimeEntryKey]
                ? timerEntriesReport[uniqueTimeEntryKey]['Time']
                : 0;
            const currentDuration =
                this.timeService.getTimestampByGivenValue(endDatetime) -
                this.timeService.getTimestampByGivenValue(startDatetime);
            timerEntriesReport[uniqueTimeEntryKey] = {
                'User name': username.replace(/,/g, ';'),
                'Project name': projectName.replace(/,/g, ';'),
                Issue: issueWithoutEstimateFromJira,
                Time: previousDuration + currentDuration,
                'Start date': this.timeService.getTimestampByGivenValue(startDatetime),
                'End date': timerEntriesReport[uniqueTimeEntryKey]
                    ? timerEntriesReport[uniqueTimeEntryKey]['End date']
                    : this.timeService.getReadableTime(endDatetime, timezoneOffset),
            };
        }

        const timerEntriesReportValues = Object.values(timerEntriesReport);
        timerEntriesReportValues.sort((a, b) => a['Start date'] - b['Start date']);
        for (let i = 0, timerEntriesReportLength = timerEntriesReportValues.length; i < timerEntriesReportLength; i++) {
            let timeEntry = timerEntriesReportValues[i];
            timeEntry['Time'] = this.timeService.getTimeDurationByGivenTimestamp(timeEntry['Time']);
            timeEntry['Start date'] = this.timeService.getReadableTime(timeEntry['Start date'], timezoneOffset);
        }

        return timerEntriesReportValues.reverse();
    }

    private prepareGeneralReportData(data: any, startDate: string, endDate: string, timezoneOffset: number): any[] {
        const { timer_v2: timerV2 } = data;
        const timerEntriesReport = {};
        for (let i = 0, timerV2Length = timerV2.length; i < timerV2Length; i++) {
            const timerEntry = timerV2[i];
            this.timerService.limitTimeEntryByStartEndDates(timerEntry, startDate, endDate);

            const { issue, start_datetime: startDatetime, end_datetime: endDatetime, project, user } = timerEntry;
            const { name: projectName } = project;
            const { email: userEmail, username: userName } = user;

            const decodedIssue = issue ? decodeURI(issue).replace(/(\r\n|\n|\r)/g, '') : '';

            const re = /[\d*.,\d]+(\s*)+[a-z|\p{L}.]+(\s*)+\|+(\s*)/gu; // match pattern "2.5h | WOB-1252", "6,5 시간 | WOB-1252" when before issue located estimate from Jira
            const findEstimateFromJira = decodedIssue.match(re);

            const issueName = Array.isArray(findEstimateFromJira)
                ? decodedIssue
                      .replace(re, '')
                      .split(' ', 1)
                      .join()
                : decodedIssue.split(' ', 1).join();

            const uniqueTimeEntryKey = `${issueName}-${projectName}-${userEmail}`;
            const previousDuration = timerEntriesReport[uniqueTimeEntryKey]
                ? timerEntriesReport[uniqueTimeEntryKey]['Time']
                : 0;
            const currentDuration =
                this.timeService.getTimestampByGivenValue(endDatetime) -
                this.timeService.getTimestampByGivenValue(startDatetime);
            timerEntriesReport[uniqueTimeEntryKey] = {
                'User name': userName.replace(/,/g, ';'),
                'Project name': projectName.replace(/,/g, ';'),
                Issue: issueName,
                Time: previousDuration + currentDuration,
            };
        }

        const timerEntriesReportValues = Object.values(timerEntriesReport);
        timerEntriesReportValues.sort((a, b) => (a['Project name'] > b['Project name'] ? 1 : -1));

        for (let i = 0, timerEntriesReportLength = timerEntriesReportValues.length; i < timerEntriesReportLength; i++) {
            const timeEntry = timerEntriesReportValues[i];
            timeEntry['Time'] = this.timeService.getTimeDurationByGivenTimestamp(timeEntry['Time']);
        }

        return timerEntriesReportValues;
    }

    private generateReport(data: any[], timezoneOffset: number): string {
        const filePath = this.fileService.saveCsvFile(
            data,
            `reports/report_${this.timeService.getReadableTime(this.timeService.getTimestamp(), timezoneOffset)}.csv`
        );

        return filePath;
    }
}
