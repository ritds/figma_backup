#!/usr/bin/node

const {readSettings, open, login, downloadFile, close} = require('./figma_actions')

let figmaLogin = '';
let figmaPassword = '';
let figmaFilesListFile = '';

const fs = require('fs');

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
    }
});

if (!figmaLogin || !figmaPassword)
{
    console.log('Usage: <script_name> <figma_login> <figma_password> <figmaFilesList>');
    process.exit(1);
}

(async() => {

    let figmaFilesList;
    fs.readFile(figmaFilesListFile, (err, data) => {
        if(err) throw err;
        figmaFilesList = JSON.parse(data);
    });
    const settings = readSettings();
    const session = await open(settings);
    session.figmaLogin = figmaLogin;
    session.figmaPassword = figmaPassword;


    await login(session, settings);

    for(let i = 0; i < figmaFilesList.length; i++) {
        const dwResult = await downloadFile(session, figmaFilesList[i], settings);
        console.log('download ('+(i+1)+'/'+figmaFilesList.length+') ' + figmaFilesList[i].key + ', ' + figmaFilesList[i].file + ' result: ' + dwResult);
    }
    close(session);
})();

