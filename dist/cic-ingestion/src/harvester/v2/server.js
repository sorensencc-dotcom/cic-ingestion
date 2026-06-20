import express from 'express';
const app = express();
const port = process.env.PORT || 3115;
app.use(express.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'harvester-v2', timestamp: new Date().toISOString() });
});
app.listen(port, () => {
    console.log(`Harvester V2 server listening on port ${port}`);
});
//# sourceMappingURL=server.js.map