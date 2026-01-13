const express = require('express');
const MBTiles = require('@mapbox/mbtiles');
const path = require('path');

const app = express();
const PORT = 8080;

const mbtilesPath = path.join(__dirname, 'data', 'indonesia.mbtiles');
let mbtilesPromise;
let mbtilesInfoPromise;

function getMbtiles() {
    if (!mbtilesPromise) {
        mbtilesPromise = new Promise((resolve, reject) => {
            new MBTiles(mbtilesPath, (err, mbtiles) => {
                if (err) reject(err);
                else resolve(mbtiles);
            });
        });
    }
    return mbtilesPromise;
}

async function getMbtilesInfo() {
    if (!mbtilesInfoPromise) {
        mbtilesInfoPromise = (async () => {
            const mbtiles = await getMbtiles();
            return new Promise((resolve, reject) => {
                mbtiles.getInfo((err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
        })();
    }
    return mbtilesInfoPromise;
}

// Serve vector tiles from MBTiles
app.get('/tiles/indonesia/:z/:x/:y.pbf', async (req, res) => {
    const { z, x, y } = req.params;
    
    try {
        const mbtiles = await getMbtiles();
        const info = await getMbtilesInfo();
        
        const zNum = parseInt(z);
        const xNum = parseInt(x);
        const yNum = parseInt(y);

        const scheme = (info && info.scheme ? String(info.scheme).toLowerCase() : 'tms');
        const tileY = scheme === 'tms' ? (1 << zNum) - 1 - yNum : yNum;
        
        const tile = await new Promise((resolve, reject) => {
            mbtiles.getTile(zNum, xNum, tileY, (err, tile, headers) => {
                if (err) reject(err);
                else resolve({ tile, headers });
            });
        });
        
        if (tile.tile) {
            res.set('Access-Control-Allow-Origin', '*');

            if (tile.headers && typeof tile.headers === 'object') {
                Object.entries(tile.headers).forEach(([k, v]) => {
                    if (v !== undefined && v !== null) {
                        res.set(k, v);
                    }
                });
            }

            if (!res.get('Content-Type')) {
                res.set('Content-Type', 'application/x-protobuf');
            }
            res.send(tile.tile);
        } else {
            // Return blank gzipped vector tile so frontend does not render placeholder color
            const zlib = require('zlib');
            const emptyTile = zlib.gzipSync(Buffer.alloc(0));
            res.set('Content-Type', 'application/x-protobuf');
            res.set('Content-Encoding', 'gzip');
            res.set('Content-Length', emptyTile.length);
            res.status(200).send(emptyTile);
        }
    } catch (error) {
        if (error.message === 'Tile does not exist') {
            const zlib = require('zlib');
            const emptyTile = zlib.gzipSync(Buffer.alloc(0));
            res.set('Content-Type', 'application/x-protobuf');
            res.set('Content-Encoding', 'gzip');
            res.set('Content-Length', emptyTile.length);
            res.status(200).send(emptyTile);
        } else {
            console.error('Error getting tile:', error);
            res.status(500).send('Error getting tile');
        }
    }
});

// Get tile metadata
app.get('/tiles/indonesia/metadata', (req, res) => {
    getMbtilesInfo()
        .then(info => res.json(info))
        .catch(err => {
            console.error('Error getting metadata:', err);
            res.status(500).send('Error getting metadata');
        });
});

app.listen(PORT, () => {
    console.log(`TileServer running at http://localhost:${PORT}`);
    console.log(`Vector tiles available at: http://localhost:${PORT}/tiles/indonesia/{z}/{x}/{y}.pbf`);
});
