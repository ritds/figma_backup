// import json
const fs = require('fs')
const path = require('path')
const yaml = require('yaml')
const date = require('date-and-time')
const { XMLHttpRequest } = require('xmlhttprequest')

// import shutil
// from datetime import datetime
// from pathlib import Path
// from urllib import request
// from urllib.error import HTTPError
// from yaml import load, Loader

const fetch = (url, opts={})=>{
    console.log('fetch', url)
    const { mode='GET', headers } = opts
    return new Promise((resolve, reject)=>{
        var xhttp = new XMLHttpRequest();
        
        xhttp.onreadystatechange = function() {
            // console.log('onreadystatechange', this.readyState, this.status)
            if (this.readyState == 4 && this.status == 200) {
               // Typical action to be performed when the document is ready:
               // document.getElementById("demo").innerHTML = xhttp.responseText;
                // console.log('respo', xhttp.responseText)
                resolve(xhttp.responseText)
            }
        };
        xhttp.open(mode, url, true);
        headers.forEach(([k, v])=>{
            // console.log('kv', k, v)
            xhttp.setRequestHeader(k, v)
        })
        xhttp.send();            
    })
}

class FigmaFilesListGetter{
    constructor(config_file_path = path.resolve('./config/get_figma_files_list.yml')){
        console.log('FigmaFilesListGetter cfg', config_file_path)
        const config_file = fs.readFileSync(config_file_path, 'utf-8')
        console.log('config_file', config_file)
        this.config = yaml.parse(config_file)

        this.token_headers = [['X-Figma-Token', this.config['access_token']||'']]
    }

    async get_team_projects(team_id){
        try{

            const api_request_url = `https://api.figma.com/v1/teams/${team_id}/projects`

            console.log(`Getting team projects, requesting URL: ${api_request_url}`)

            const api_response = await fetch(
                api_request_url, 
                {
                    mode:'GET', 
                    headers: this.token_headers 
                })


//             console.log('api_response', api_response)
// 
            const api_response_data = JSON.parse(api_response)
            console.log(api_response_data)

            const team_name = api_response_data.name||team_id
            const team_projects = []

            const { projects=[] } = api_response_data

            for(let i in projects){
                team_projects.push(
                    {
                        'id': projects[i].id,
                        'team': team_name
                    }
                )
            }

            return team_projects

        } catch(err){
            console.error(err)
            return ''
        }
    }

    async get_teams_projects(){
        console.log('Getting the projects of all teams listed in config, if any, removing duplicates')

        let teams_projects = []

        const teams = this.config['teams']||[]
        console.log('teams', teams)
        for(let i in teams){
            const team_projects = await this.get_team_projects(teams[i])
            teams_projects = teams_projects.concat(team_projects)
        }

        return teams_projects
    }

    merge_projects(teams_projects){
        console.log('Merging teams projects with projects listed in config, if any, removing duplicates')

        const merged_projects = []
        const seen_projects_ids = []

        for(let i in teams_projects){
            const project = teams_projects[i]
            if(!seen_projects_ids.find(id=>id == project.id)){
                merged_projects.push(project)
                seen_projects_ids.push(project.id)
            }
        }
// 
//         for(let project_id in list(set(self.config.get('projects', [])))){
//             project_id = str(project_id)
// 
//             if(project_id not in seen_projects_ids){
//                 merged_projects.append(
//                     {
//                         'id': project_id,
//                         'team': ''
//                     }
//                 )
// 
//                 seen_projects_ids.add(project_id)
//             }
//         }

        return merged_projects
    }

    async get_project_files(project){
        const api_request_url = `https://api.figma.com/v1/projects/${project["id"]}/files`
        const today = date.format(new Date(), 'YY-MM-DD')

        console.log(`Getting project files, requesting URL: ${api_request_url}`, today)

        const api_response = await fetch(
            api_request_url, 
            {
                mode:'GET', 
                headers: this.token_headers
            })

        const api_response_data = JSON.parse(api_response)

        // console.log('api_response_data', api_response_data)

        // if(api_response['status'] != 200 or api_response_data.get('err', None)){
        //     console.log('Failed to perform API request')
        //     return []
        // }

        const project_name = api_response_data.name||project.id
        const project_files = []

        const { files } = api_response_data

        for(let i in files){
            const file = files[i]

            const file_name_to_check = `./store/TEAM ${project["team"]}/PROJECT ${project_name}/${file["name"]}.fig`
            // let time = 0
            // if(os.path.isfile(file_name_to_check)){
            //     time = os.path.getmtime(file_name_to_check)
            // }
            // const updates = datetime.strptime(
            //     file["last_modified"], "%Y-%m-%dT%H:%M:%SZ").timestamp()
            // console.log(f'time: {time}, updated: {updates}')
            // if(time < updates){
                // console.log(`File TEAM ${project["team"]}/PROJECT ${project_name}/${file["name"]}, key ${file["key"]}, last modified: ${file["last_modified"]} -> adding to the list`)
                project_files.push(
                    {
                        'key': file.key,
                        'name': file.name,
                        'project': project_name,
                        'team': project.team,
                        'last_modified': file['last_modified']
                    }
                )
                // if(os.path.isfile(file_name_to_check)){
                //     if not os.path.exists(f'./store/{today}'):
                //         os.makedirs(f'./store/{today}')
                //     if not os.path.exists(f'./store/{today}/TEAM {project["team"]}'):
                //         os.makedirs(f'./store/{today}/TEAM {project["team"]}')
                //     if not os.path.exists(f'./store/{today}/TEAM {project["team"]}/PROJECT {project_name}/'):
                //         os.makedirs(
                //             f'./store/{today}/TEAM {project["team"]}/PROJECT {project_name}/')
                //     shutil.copyfile(
                //         file_name_to_check, f'./store/{today}/TEAM {project["team"]}/PROJECT {project_name}/{file["name"]}.fig')
                //     os.remove(file_name_to_check)
                // }
            // }else{
            //     console.log(`File ${project["team"]}/${project_name}/${file["name"]}, key ${file["key"]}, last modified: ${file["last_modified"]} not modifided`)
            // }
        }

        return project_files
    }

    async get_projects_files(projects){
        console.log('Getting the files of all projects')

        let projects_files = []

        for( let i in projects ){
            const project_files = await this.get_project_files(projects[i])
            projects_files = projects_files.concat(project_files)
        }

        return projects_files
    }

    merge_files(projects_files){
        console.log('Merging projects files with files listed in config, if any, removing duplicates')

        const merged_files = []
        const seen_files_keys = []

        for(let i in projects_files){
            const file = projects_files[i]
            if(!seen_files_keys.find(v=>v==file.key)){
                merged_files.push(file)
                seen_files_keys.push(file.key)
            }
        }

        const file_keys = this.config.files||[]
        for(let i in file_keys){
            const file_key = ""+file_keys[i]

            if(!seen_files_keys.find(v=>v==file_key)){
                merged_files.push(
                    {
                        'key': file_key,
                        'project': '',
                        'team': ''
                    }
                )

                seen_files_keys.push(file_key)
            }
        }

        return merged_files
    }

    async perform(){
        const teams_projects = await this.get_teams_projects()
        // console.log('teams_projects', teams_projects)
        const projects = this.merge_projects(teams_projects)
        // console.log('projects', projects)
        const projects_files = await this.get_projects_files(projects)
        const files = this.merge_files(projects_files)
        console.log('files', files)
//         const output_file_path = Path(self.config.get(
//             'output_file', './process/figma_files_list.json'))
//         const output_limit = self.config.get('output_limit', 0)
// 
//         if not output_limit or len(files) <= output_limit:
//             console.log('Writing the single output file')
// 
//             with open(output_file_path, 'w', encoding='utf8') as output_file:
//                 json.dump(files, output_file, ensure_ascii=False, indent=4)
// 
//         else:
//             console.log('Writing multiple output files with partial slices')
// 
//             parts_count = int((len(files) - 1) / output_limit) + 1
// 
//             for part_number in range(1, parts_count + 1):
//                 start = output_limit * (part_number - 1)
//                 stop = output_limit * (part_number)
//                 files_part = files[start:stop]
// 
//                 partial_output_file_path = (
//                     output_file_path.parent /
//                     f'{output_file_path.stem}_part_{part_number}{output_file_path.suffix}'
//                 )
// 
//                 with open(partial_output_file_path, 'w', encoding='utf8') as partial_output_file:
//                     json.dump(files_part, partial_output_file,
//                               ensure_ascii=False, indent=4)
// 
//         console.log('Done')

    }
}
// if __name__ == "__main__":
//     FigmaFilesListGetter().perform()

module.exports = FigmaFilesListGetter