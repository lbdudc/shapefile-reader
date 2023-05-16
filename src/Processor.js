import fs from 'fs';
import shapefile from 'shapefile';
import { detectEncoding } from './utils/utils.js';


class Processor {

    constructor(options) {
        this.options = options || {
            encoding: 'auto',
            schema: true,
            geographicInfo: true,
            records: true,
        };
    }

    /**
     * Process the folder and generate a json object with the information of the shapefiles
     * @param {String} folderPath 
     * @returns {Object} content with the information of the shapefiles
     */
    async getSHPFolderInfo(folderPath) {
        console.log(`Processing folder ${folderPath}`);

        const files = await fs.promises.readdir(folderPath);

        let content = [];

        for (const file of files) {
            if (file.endsWith('.shp')) {
                const shapefilePath = folderPath + file;
                const fileContent = await this._processShapefile(shapefilePath);
                content.push(fileContent);
            }
        }

        return content;
    }


    /**
     * Process the shapefile and generate a json object with the information of the shapefile
     * @param {String} shapefilePath
     * @returns {Object} content with the information of the shapefile
     */
    async _processShapefile(shapefilePath) {
        const fileName = shapefilePath.split('/').pop();

        // Detect the encoding of the shapefile
        const encoding = this.options.encoding === 'auto' ? detectEncoding(shapefilePath) : this.options.encoding;

        console.log(`Processing ${fileName} with encoding ${encoding}`);

        // Retrieve the geographic information from .shp file
        const source = await shapefile.open(shapefilePath, undefined, {
            encoding: encoding
        });
        const geojson = await source.read();
        const geographicInfo = JSON.stringify(geojson);

        // Retrieve the data from .dbf file
        const dbfFilePath = shapefilePath.replace('.shp', '.dbf');
        const dbfData = await shapefile.openDbf(dbfFilePath);
        const records = await dbfData.read();

        // Retrieve the schema from .dbf file
        const schemaFields = dbfData._fields
            .filter((field, index, self) =>
                index === self.findIndex((t) => (
                    t.name === field.name && t.type === field.type
                ))
            )
            .map((field) => {
                return {
                    name: field.name,
                    type: field.type === 'N' ? 'Number' : 'String',
                    length: field.length,
                }
            });

        // Generate the final result
        let res = {
            name: fileName.split('.')[0],
            fileName: fileName,
            schema: schemaFields,
            geographicInfo: JSON.parse(geographicInfo),
            records: records,
        }

        // delete res keys if options.records or options.geographicInfo are false
        if (!this.options.records) delete res.records;
        if (!this.options.geographicInfo) delete res.geographicInfo;

        return res;
    }

}


export default Processor;