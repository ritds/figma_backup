#!/usr/bin/node

// Command line arguments
let figmaLogin = '';
let figmaPassword = '';
let figmaFilesListFile = '';
let downloadsBaseDir = '';
let debugDir = '';
let figmaUrl = '';
let settingFile = '';

const downloadFigmaFiles = require('./download_figma_files_core')

process.argv.forEach((arg) => {
    const keyValue = arg.split("=");
    switch (keyValue[0]) {
        case 'figmaLogin':
            figmaLogin = keyValue[1];
            break;
        case 'figmaPassword':
            figmaPassword = keyValue[1];
            break;
        case 'figmaFilesList':
            figmaFilesListFile = keyValue[1];
            break;
        case 'downloadsBaseDir':
            downloadsBaseDir = keyValue[1];
            break;
        case 'debugDir':
            debugDir = keyValue[1];
            break;
        case 'figmaUrl':
            figmaUrl = keyValue[1];
            break;
        case 'settingFile': 
            settingFile = keyValue[1];
            break;
    }
})

if(!figmaLogin || !figmaPassword || (!figmaFilesListFile && !figmaUrl))
{
    console.log('Usage: <script_name> <figma_login> <figma_password> <figma_files_list_file> <downloads_base_dir> [<debug_dir>]');
    process.exit(1);
}

downloadFigmaFiles({
    figmaLogin,
    figmaPassword,
    figmaFilesListFile,
    figmaUrl,
    downloadsBaseDir,
    debugDir,
    settingFile,
})