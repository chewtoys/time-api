import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Response,
    HttpStatus,
    Body,
    Query,
    Headers,
} from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';

import { ProjectService } from './project.service';
import { TeamService } from '../team/team.service';
import { Project } from './interfaces/project.interface';

@Controller('project')
export class ProjectController {
    constructor(private readonly projectService: ProjectService, private readonly teamService: TeamService) {}

    @Get('list')
    async projectList(@Response() res: any, @Query() params) {
        if (!params.userId) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'User ID needs to be specified.' });
        }
        try {
            const projectListRes = await this.projectService.getProjectList(params.userId);
            return res.status(HttpStatus.OK).json(projectListRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Get('admin-list')
    async adminProjectList(@Response() res: any, @Query() params) {
        if (!params.userId) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'User ID needs to be specified.' });
        }
        try {
            const adminProjectListRes = await this.projectService.getAdminProjectList(params.userId);
            return res.status(HttpStatus.OK).json(adminProjectListRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Get('user-list')
    async userProjectList(@Response() res: any, @Query() params) {
        if (!(params && params.userId)) {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'Parameter userId is required!' });
        }

        try {
            const userProjectListRes = await this.projectService.getUserProjectList(params.userId);
            return res.status(HttpStatus.OK).json(userProjectListRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Get('reports-project')
    async reportsProjectList(@Headers() header: any, @Response() res: any, @Query() params) {
        if (!(header && header['x-user-id'])) {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'x-user-id header is required!' });
        }

        if (!(params && params.projectName && params.startDate && params.endDate)) {
            return res
                .status(HttpStatus.FORBIDDEN)
                .json({ message: 'Parameters projectName, startDate and endDate are required!' });
        }

        if (params && params.userEmails && Object.prototype.toString.call(params.userEmails) !== '[object Array]') {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'Parameters userEmails needs to be an array!' });
        }

        let teamId;
        try {
            const currentTeamRes = await this.teamService.getCurrentTeam(header['x-user-id']);
            teamId = (currentTeamRes as AxiosResponse).data.user_team[0].team.id;
        } catch (err) {
            const error: AxiosError = err;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }

        if (!teamId) {
            return res.status(HttpStatus.FORBIDDEN).json({ message: "The user isn't a member of any team!" });
        }

        try {
            const reportsProjectRes = await this.projectService.getReportsProject(
                teamId,
                params.projectName,
                params.userEmails || [],
                params.startDate,
                params.endDate
            );
            return res.status(HttpStatus.OK).json(reportsProjectRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Get('reports-projects')
    async reportsProjectsList(@Headers() header: any, @Response() res: any, @Query() params) {
        if (!(header && header['x-user-id'])) {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'x-user-id header is required!' });
        }

        if (params && params.projectNames && Object.prototype.toString.call(params.projectNames) !== '[object Array]') {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'Parameters projectNames needs to be an array!' });
        }

        if (params && params.userEmails && Object.prototype.toString.call(params.userEmails) !== '[object Array]') {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'Parameters userEmails needs to be an array!' });
        }

        let teamId;
        try {
            const currentTeamRes = await this.teamService.getCurrentTeam(header['x-user-id']);
            teamId = (currentTeamRes as AxiosResponse).data.user_team[0].team.id;
        } catch (err) {
            const error: AxiosError = err;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }

        if (!teamId) {
            return res.status(HttpStatus.FORBIDDEN).json({ message: "The user isn't a member of any team!" });
        }

        try {
            const reportsProjectsRes = await this.projectService.getReportsProjects(
                teamId,
                params.projectNames || [],
                params.userEmails || [],
                params.startDate,
                params.endDate
            );
            return res.status(HttpStatus.OK).json(reportsProjectsRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Post('add')
    //@TODO: Make sure to implement userId passage from front.
    async addProject(@Response() res: any, @Body() body: { project: Project; userId: string }) {
        if (!(body && body.userId && body.project.name && body.project.projectColorId)) {
            return res
                .status(HttpStatus.FORBIDDEN)
                .json({ message: 'User ID, Project name and projectColorId are required!' });
        }

        try {
            const addProjectRes = await this.projectService.addProject(body.project, body.userId);
            return res.status(HttpStatus.OK).json(addProjectRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Get(':id')
    async getProjectById(@Param() param: any, @Response() res: any) {
        try {
            const getProjectByIdRes = await this.projectService.getProjectById(param.id);
            return res.status(HttpStatus.OK).json(getProjectByIdRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Patch(':id')
    async updateProjectById(@Param() param: any, @Response() res: any, @Body() body: Project) {
        if (!(body && body.name && body.projectColorId)) {
            return res.status(HttpStatus.FORBIDDEN).json({ message: 'Project name and projectColorId are required!' });
        }

        try {
            const updateProjectByIdRes = await this.projectService.updateProjectById(param.id, body);
            return res.status(HttpStatus.OK).json(updateProjectByIdRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }

    @Delete(':id')
    async deleteProjectById(@Param() param: any, @Response() res: any) {
        try {
            const deleteProjectByIdRes = await this.projectService.deleteProjectById(param.id);
            return res.status(HttpStatus.OK).json(deleteProjectByIdRes);
        } catch (e) {
            const error: AxiosError = e;
            return res.status(HttpStatus.BAD_REQUEST).json(error.response ? error.response.data.errors : error);
        }
    }
}
