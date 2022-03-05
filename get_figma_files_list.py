#!/usr/bin/python3 -u

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from urllib import request
from urllib.error import HTTPError
from yaml import load, Loader


class FigmaFilesListGetter(object):
    def __init__(self, config_file_path: Path = Path('./config/get_figma_files_list.yml')):
        with open(config_file_path) as config_file:
            self.config = load(config_file, Loader)

        self.token_header = {'X-Figma-Token': self.config['access_token']}

    def _http_request(
        self,
        request_url: str,
        request_method: str = 'GET',
        request_headers: dict or None = None,
        request_data: bytes or None = None
    ) -> dict:
        http_request = request.Request(request_url, method=request_method)

        if request_headers:
            http_request.headers = request_headers

        if request_data:
            http_request.data = request_data

        try:
            with request.urlopen(http_request) as http_response:
                response_status = http_response.getcode()
                response_headers = http_response.info()
                response_data = http_response.read()

        except HTTPError as http_response_not_ok:
            response_status = http_response_not_ok.getcode()
            response_headers = http_response_not_ok.info()
            response_data = http_response_not_ok.read()

        return {
            'status': response_status,
            'headers': response_headers,
            'data': response_data
        }

    def _get_team_projects(self, team_id: str) -> list:
        api_request_url = f'https://api.figma.com/v1/teams/{team_id}/projects'

        print(f'Getting team projects, requesting URL: {api_request_url}')

        api_response = self._http_request(
            api_request_url, 'GET', self.token_header)
        api_response_data = json.loads(api_response['data'].decode('utf-8'))

        print(f'Status: {api_response["status"]}')

        if api_response['status'] != 200 or api_response_data.get('err', None):
            print('Failed to perform API request')
            return []

        team_name = api_response_data.get('name', team_id)
        team_projects = []

        for project in api_response_data.get('projects', []):
            team_projects.append(
                {
                    'id': project['id'],
                    'team': team_name
                }
            )

        return team_projects

    def _get_teams_projects(self) -> list:
        print('Getting the projects of all teams listed in config, if any, removing duplicates')

        teams_projects = []

        for team_id in list(set(self.config.get('teams', []))):
            team_projects = self._get_team_projects(str(team_id))
            teams_projects.extend(team_projects)

        return teams_projects

    def _merge_projects(self, teams_projects: list) -> list:
        print('Merging teams projects with projects listed in config, if any, removing duplicates')

        merged_projects = []
        seen_projects_ids = set()

        for project in teams_projects:
            if project['id'] not in seen_projects_ids:
                merged_projects.append(project)
                seen_projects_ids.add(project['id'])

        for project_id in list(set(self.config.get('projects', []))):
            project_id = str(project_id)

            if project_id not in seen_projects_ids:
                merged_projects.append(
                    {
                        'id': project_id,
                        'team': ''
                    }
                )

                seen_projects_ids.add(project_id)

        return merged_projects

    def _get_project_files(self, project: dict) -> list:
        api_request_url = f'https://api.figma.com/v1/projects/{project["id"]}/files'
        today = datetime.today().strftime('%Y-%m-%d')

        print(f'Getting project files, requesting URL: {api_request_url}')

        api_response = self._http_request(
            api_request_url, 'GET', self.token_header)

        api_response_data = json.loads(api_response['data'].decode('utf-8'))

        print(f'Status: {api_response["status"]}')

        if api_response['status'] != 200 or api_response_data.get('err', None):
            print('Failed to perform API request')
            return []

        project_name = api_response_data.get('name', project['id'])
        project_files = []

        for file in api_response_data.get('files', []):

            file_name_to_check = f'./store/TEAM {project["team"]}/PROJECT {project_name}/{file["name"]}.fig'
            time = 0
            if os.path.isfile(file_name_to_check):
                time = os.path.getmtime(
                    f'./store/TEAM {project["team"]}/PROJECT {project_name}/{file["name"]}.fig')
            updates = datetime.strptime(
                file["last_modified"], "%Y-%m-%dT%H:%M:%SZ").timestamp()
            print(f'time: {time}, updated: {updates}')
            if time < updates:
                print(
                    f'File TEAM {project["team"]}/PROJECT {project_name}/{file["name"]}, key {file["key"]}, last modified: {file["last_modified"]} -> adding to the list')
                project_files.append(
                    {
                        'key': file['key'],
                        'project': project_name,
                        'team': project['team'],
                        'last_modified': file['last_modified']
                    }
                )
                if os.path.isfile(file_name_to_check):
                    if not os.path.exists(f'./store/{today}/TEAM {project["team"]}/PROJECT {project_name}/'):
                        os.makedirs(f'./store/{today}')
                    shutil.copyfile(
                        file_name_to_check, f'./store/{today}/TEAM {project["team"]}/PROJECT {project_name}/{file["name"]}.fig')
                    os.remove(file_name_to_check)
            else:
                print(
                    f'File {project["team"]}/{project_name}/{file["name"]}, key {file["key"]}, last modified: {file["last_modified"]} not modifided')

        return project_files

    def _get_projects_files(self, projects: list) -> list:
        print('Getting the files of all projects')

        projects_files = []

        for project in projects:
            project_files = self._get_project_files(project)
            projects_files.extend(project_files)

        return projects_files

    def _merge_files(self, projects_files: list) -> list:
        print('Merging projects files with files listed in config, if any, removing duplicates')

        merged_files = []
        seen_files_keys = set()

        for file in projects_files:
            if file['key'] not in seen_files_keys:
                merged_files.append(file)
                seen_files_keys.add(file['key'])

        for file_key in list(set(self.config.get('files', []))):
            file_key = str(file_key)

            if file_key not in seen_files_keys:
                merged_files.append(
                    {
                        'key': file_key,
                        'project': '',
                        'team': ''
                    }
                )

                seen_files_keys.add(file_key)

        return merged_files

    def perform(self) -> None:
        teams_projects = self._get_teams_projects()
        projects = self._merge_projects(teams_projects)
        projects_files = self._get_projects_files(projects)
        files = self._merge_files(projects_files)
        output_file_path = Path(self.config.get(
            'output_file', './process/figma_files_list.json'))
        output_limit = self.config.get('output_limit', 0)

        if not output_limit or len(files) <= output_limit:
            print('Writing the single output file')

            with open(output_file_path, 'w', encoding='utf8') as output_file:
                json.dump(files, output_file, ensure_ascii=False, indent=4)

        else:
            print('Writing multiple output files with partial slices')

            parts_count = int((len(files) - 1) / output_limit) + 1

            for part_number in range(1, parts_count + 1):
                start = output_limit * (part_number - 1)
                stop = output_limit * (part_number)
                files_part = files[start:stop]

                partial_output_file_path = (
                    output_file_path.parent /
                    f'{output_file_path.stem}_part_{part_number}{output_file_path.suffix}'
                )

                with open(partial_output_file_path, 'w', encoding='utf8') as partial_output_file:
                    json.dump(files_part, partial_output_file,
                              ensure_ascii=False, indent=4)

        print('Done')


if __name__ == "__main__":
    FigmaFilesListGetter().perform()
