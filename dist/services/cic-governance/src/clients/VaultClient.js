/**
 * VaultClient — HTTP client for Vault (Phase 24 M3 endpoint)
 * Handles deterministic digest computation and CRUD
 */
import crypto from 'crypto';
import axios from 'axios';
export class VaultClient {
    constructor(baseUrl = 'http://localhost:3100') {
        this.http = axios.create({ baseURL: baseUrl });
    }
    sha256(input) {
        return crypto.createHash('sha256').update(input).digest('hex');
    }
    /**
     * Write packet to Vault with computed digest
     */
    async write(packet) {
        const createdAt = new Date().toISOString();
        const id = crypto.randomUUID();
        const base = { ...packet, id, createdAt };
        const vaultDigest = this.sha256(JSON.stringify(base));
        const res = await this.http.post('/vault/records', {
            ...base,
            vaultDigest,
        });
        return res.data;
    }
    /**
     * Query packets by proposal ID
     */
    async listByProposal(proposalId) {
        const res = await this.http.get('/vault/records', {
            params: { proposalId },
        });
        return (res.data || []);
    }
    /**
     * Get single packet by ID
     */
    async get(id) {
        try {
            const res = await this.http.get(`/vault/records/${id}`);
            return res.data;
        }
        catch (err) {
            if (err.response?.status === 404) {
                return null;
            }
            throw err;
        }
    }
}
//# sourceMappingURL=VaultClient.js.map