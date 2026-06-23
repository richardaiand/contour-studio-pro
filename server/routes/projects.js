import { getDb, generateId } from '../db.js';
import { now, parseJson } from '../utils/index.js';
import { AppError } from '../errors.js';

function serializeProject(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    detailLevel: row.detail_level,
    bounds: parseJson(row.bounds_json),
    center: parseJson(row.center_json),
    sourceInfo: parseJson(row.source_info_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeMessage(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    role: row.role,
    content: row.content,
    metadata: parseJson(row.metadata_json),
    createdAt: row.created_at,
  };
}

export default async function (fastify) {
  // List projects
  fastify.get('/', { onRequest: [fastify.authenticate] }, async (req) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
      .all(req.user.userId);
    return rows.map(serializeProject);
  });

  // Create project
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          detailLevel: { type: 'string', enum: ['draft', 'standard', 'survey'] },
          bounds: { type: 'object' },
          center: { type: 'object' },
          sourceInfo: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const db = getDb();
    const id = generateId();
    const createdAt = now();
    const { title, detailLevel = 'standard', bounds, center, sourceInfo } = req.body;

    db.prepare(
      `INSERT INTO projects (id, user_id, title, detail_level, bounds_json, center_json, source_info_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user.userId,
      title.slice(0, 200),
      detailLevel,
      bounds ? JSON.stringify(bounds) : null,
      center ? JSON.stringify(center) : null,
      sourceInfo ? JSON.stringify(sourceInfo) : null,
      createdAt,
      createdAt
    );

    reply.status(201);
    return serializeProject(
      db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    );
  });

  // Get project with messages
  fastify.get('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const db = getDb();
    const project = db
      .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.userId);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const messages = db
      .prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC')
      .all(project.id);

    return {
      project: serializeProject(project),
      messages: messages.map(serializeMessage),
    };
  });

  // Update project
  fastify.patch('/:id', { onRequest: [fastify.authenticate] }, async (req) => {
    const db = getDb();
    const project = db
      .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.userId);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const { title, detailLevel, bounds, center, sourceInfo } = req.body;
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title.slice(0, 200));
    }
    if (detailLevel !== undefined) {
      updates.push('detail_level = ?');
      values.push(detailLevel);
    }
    if (bounds !== undefined) {
      updates.push('bounds_json = ?');
      values.push(JSON.stringify(bounds));
    }
    if (center !== undefined) {
      updates.push('center_json = ?');
      values.push(JSON.stringify(center));
    }
    if (sourceInfo !== undefined) {
      updates.push('source_info_json = ?');
      values.push(JSON.stringify(sourceInfo));
    }

    if (updates.length === 0) return serializeProject(project);

    updates.push('updated_at = ?');
    values.push(now());
    values.push(req.params.id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return serializeProject(
      db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
    );
  });

  // Delete project
  fastify.delete('/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const db = getDb();
    const result = db
      .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.userId);
    if (result.changes === 0) throw new AppError('Project not found', 404, 'NOT_FOUND');
    return { ok: true };
  });

  // Add message
  fastify.post('/:id/messages', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant', 'system'] },
          content: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const db = getDb();
    const project = db
      .prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.userId);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const id = generateId();
    const { role, content, metadata } = req.body;
    db.prepare(
      'INSERT INTO messages (id, project_id, role, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      req.params.id,
      role,
      content,
      metadata ? JSON.stringify(metadata) : null,
      now()
    );

    reply.status(201);
    return serializeMessage(
      db.prepare('SELECT * FROM messages WHERE id = ?').get(id)
    );
  });
}
