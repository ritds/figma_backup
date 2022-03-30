#!/usr/bin/node

const {readSettings, open, login, downloadFile, close} = require('./figma_actions')

let figmaLogin = '';
let figmaPassword = '';
let figmaUrl = '';

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
        case 'figmaUrl':
            figmaUrl = keyValue[1];
            break;
    }
});

if (!figmaLogin || !figmaPassword || !figmaUrl)
{
    console.log('Usage: <script_name> <figma_login> <figma_password> <figmaUrl>');
    process.exit(1);
}

(async() => {

    let figmaFilesList;
    figmaFilesList = [
        {
            uri: figmaUrl,
            path: './store/download',
        }
    ]
    const settings = readSettings();
    const session = await open(settings);
    session.figmaLogin = figmaLogin;
    session.figmaPassword = figmaPassword;


    await login(session, settings);

    for(let i = 0; i < figmaFilesList.length; i++) {
        const dwResult = await downloadFile(session, figmaFilesList[i], settings);
        console.log('download ' + figmaFilesList[i].key + ',' + figmaFilesList[i].file + ' result: ' + dwResult);
    }
    close(session);
})();

