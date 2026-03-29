const router = require('express').Router();
const db = require('../db/schema');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { err } = require('../middleware/error');
const { sanitizeText } = require('../utils/sanitize');
const { sendBackInStockEmail } = require('../utils/mailer');
const AutomaticOrderProcessor = require('../services/AutomaticOrderProcessor');

function normalizePreorderInput(body) {
  const isPreorder =
    body.is_preorder === true || body.is_preorder === 1 || body.is_preorder === '1';

  let preorderDeliveryDate = body.preorder_delivery_date || null;
  if (preorderDeliveryDate) {
    preorderDeliveryDate = String(preorderDeliveryDate).trim();
  }

  if (isPreorder) {
    if (!preorderDeliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(preorderDeliveryDate)) {
      return { error: 'preorder_delivery_date must be provided as YYYY-MM-DD for pre-order products' };
    }
  } else {
    preorderDeliveryDate = null;
  }

  return { isPreorder, preorderDeliveryDate };
}

function isFlashSaleActive(product) {
  if (!product?.flash_sale_price || !product?.flash_sale_ends_at) return false;
  return new Date(product.flash_sale_ends_at).getTime() > Date.now();
}

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product listings
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Browse all products (paginated, filterable)
 *     tags: [Products]
 */
router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { category, minPrice, maxPrice, seller, available = 'true', lat, lng, radius, grade } = req.query;

  const conditions = [];
  const params = [];

  if (available === 'true') conditions.push('p.quantity > 0');
  if (category) {
    conditions.push(`p.category = $${params.length + 1}`);
    params.push(category);
  }
  if (minPrice !== undefined) {
    const min = parseFloat(minPrice);
    if (!isNaN(min)) {
      conditions.push(`p.price >= $${params.length + 1}`);
      params.push(min);
    }
  }
  if (maxPrice !== undefined) {
    const max = parseFloat(maxPrice);
    if (!isNaN(max)) {
      conditions.push(`p.price <= $${params.length + 1}`);
      params.push(max);
    }
  }
  if (seller) {
    conditions.push(`u.name ${db.isPostgres ? 'ILIKE' : 'LIKE'} $${params.length + 1}`);
    params.push(`%${seller}%`);
  }
  if (grade) {
    const VALID_GRADES = ['A', 'B', 'C', 'Ungraded'];
    if (VALID_GRADES.includes(grade)) {
      conditions.push(`p.grade = $${params.length + 1}`);
      params.push(grade);
    }
  }

  const filterLat = parseFloat(lat);
  const filterLng = parseFloat(lng);
  const filterRadius = parseFloat(radius);
  if (!isNaN(filterLat) && !isNaN(filterLng) && !isNaN(filterRadius) && filterRadius > 0) {
    conditions.push(`u.latitude IS NOT NULL AND u.longitude IS NOT NULL`);
    // Note: This distance formula might need adjustment depending on DB type if complex, 
    // but basic Haversine often works or is replaced by native geo functions in production.
    conditions.push(
      `(6371 * acos(LEAST(1.0, cos(radians($${params.length + 1})) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians($${params.length + 2})) + sin(radians($${params.length + 1})) * sin(radians(u.latitude))))) <= $${params.length + 3}`
    );
    params.push(filterLat, filterLng, filterRadius);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await db.query(
    `SELECT COUNT(*) as count FROM products p JOIN users u ON p.farmer_id = u.id ${where}`,
    params
  );
  const total = parseInt(countRes.rows[0].count);

  const { rows: products } = await db.query(
    `SELECT p.*, u.name as farmer_name, u.latitude as farmer_lat, u.longitude as farmer_lng, u.farm_address as farmer_farm_address,
            ROUND(AVG(r.rating)${db.isPostgres ? '::numeric' : ''}, 1) as avg_rating,
            COUNT(r.id) as review_count
     FROM products p
     JOIN users u ON p.farmer_id = u.id
     LEFT JOIN reviews r ON r.product_id = p.id
     ${where}
     GROUP BY p.id, u.name, u.latitude, u.longitude, u.farm_address
     ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: products,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/products/search
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    const { rows } = await db.query(
      `SELECT p.*, u.name as farmer_name FROM products p JOIN users u ON p.farmer_id = u.id ORDER BY p.created_at DESC LIMIT 100`
    );
    return res.json({ success: true, data: rows });
  }
  const like = `%${q}%`;
  const { rows } = await db.query(
    `SELECT p.*, u.name as farmer_name FROM products p JOIN users u ON p.farmer_id = u.id
     WHERE p.name ${db.isPostgres ? 'ILIKE' : 'LIKE'} $1 OR p.description ${db.isPostgres ? 'ILIKE' : 'LIKE'} $2 
     ORDER BY p.created_at DESC LIMIT 100`,
    [like, like]
  );
  res.json({ success: true, data: rows });
});

router.get('/categories', async (_req, res) => {
  const { rows } = await db.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category');
  res.json({ success: true, data: rows.map(r => r.category) });
});

router.get('/mine/list', auth, async (req, res) => {
  if (req.user.role !== 'farmer') return err(res, 403, 'Farmers only', 'forbidden');
  const { rows } = await db.query('SELECT * FROM products WHERE farmer_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ success: true, data: rows });
});

router.post('/upload-image', auth, (req, res) => {
  if (req.user.role !== 'farmer') return err(res, 403, 'Only farmers can upload images', 'forbidden');
  upload.single('image')(req, res, (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') return err(res, 400, 'Image must be 5 MB or smaller', 'file_too_large');
      return err(res, 400, 'Upload failed', 'upload_error');
    }
    if (!req.file) return err(res, 400, 'No image file provided', 'no_file');
    res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
  });
});

router.get('/:id', async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, u.name as farmer_name, u.bio as farmer_bio, u.location as farmer_location, u.avatar_url as farmer_avatar, u.stellar_public_key as farmer_wallet,
            ROUND(AVG(r.rating)${db.isPostgres ? '::numeric' : ''}, 1) as avg_rating,
            COUNT(r.id) as review_count
     FROM products p
     JOIN users u ON p.farmer_id = u.id
     LEFT JOIN reviews r ON r.product_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, u.name, u.bio, u.location, u.avatar_url, u.stellar_public_key`,
    [req.params.id]
  );
  if (!rows[0]) return err(res, 404, 'Product not found', 'not_found');
  res.json({ success: true, data: rows[0] });
});

router.post('/', auth, validate.product, async (req, res) => {
  if (req.user.role !== 'farmer') return err(res, 403, 'Only farmers can list products', 'forbidden');

  const { name, description, unit, category, image_url, nutrition, pricing_model, pricing_type } = req.body;
  const price = parseFloat(req.body.price);
  const quantity = parseInt(req.body.quantity, 10);

  if (!name || !name.trim()) return err(res, 400, 'Product name is required', 'validation_error');
  if (isNaN(price) || price <= 0) return err(res, 400, 'Price must be a positive number', 'validation_error');
  if (isNaN(quantity) || quantity < 1) return err(res, 400, 'Quantity must be a positive integer', 'validation_error');

  const preorder = normalizePreorderInput(req.body);
  if (preorder.error) return err(res, 400, preorder.error, 'validation_error');

  const model = pricing_model || 'fixed';
  const minPrice = model === 'pwyw' ? parseFloat(req.body.min_price) : null;
  if (model === 'pwyw' && (isNaN(minPrice) || minPrice < 0)) {
    return err(res, 400, 'Minimum price is required for PWYW products', 'validation_error');
  }

  const { rows } = await db.query(
    `INSERT INTO products (
      farmer_id, name, description, category, price, quantity, unit, image_url, 
      is_preorder, preorder_delivery_date, low_stock_threshold, nutrition, 
      pricing_model, min_price, pricing_type
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
    [
      req.user.id, sanitizeText(name), sanitizeText(description || ''), sanitizeText(category || 'other'),
      price, quantity, sanitizeText(unit || 'unit'), image_url || null,
      preorder.isPreorder ? 1 : 0, preorder.preorderDeliveryDate,
      parseInt(req.body.low_stock_threshold) || 5, nutrition ? JSON.stringify(nutrition) : null,
      model, minPrice, pricing_type || 'unit'
    ]
  );

  res.json({ success: true, id: rows[0].id, message: 'Product listed' });
});

router.patch('/:id', auth, async (req, res) => {
  if (req.user.role !== 'farmer') return err(res, 403, 'Only farmers can edit products', 'forbidden');

  const { rows: existing } = await db.query('SELECT * FROM products WHERE id = $1 AND farmer_id = $2', [req.params.id, req.user.id]);
  if (!existing[0]) return err(res, 404, 'Not found or not yours', 'not_found');

  const allowed = [
    'name', 'description', 'price', 'quantity', 'unit', 'category', 
    'low_stock_threshold', 'nutrition', 'pricing_model', 'min_price', 
    'pricing_type', 'is_preorder', 'preorder_delivery_date'
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.name) updates.name = sanitizeText(updates.name);
  if (updates.description) updates.description = sanitizeText(updates.description);
  if (updates.price !== undefined) {
    updates.price = parseFloat(updates.price);
    if (isNaN(updates.price) || updates.price <= 0) return err(res, 400, 'Price must be positive', 'validation_error');
  }
  if (updates.quantity !== undefined) {
    updates.quantity = parseInt(updates.quantity, 10);
    if (isNaN(updates.quantity) || updates.quantity < 0) return err(res, 400, 'Quantity must be non-negative', 'validation_error');
  }
  if (updates.pricing_model === 'pwyw' && updates.min_price === undefined && existing[0].min_price === null) {
    return err(res, 400, 'Minimum price is required for PWYW', 'validation_error');
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return res.json({ success: true, message: 'No changes' });

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await db.query(`UPDATE products SET ${setClauses} WHERE id = $${keys.length + 1}`, [...Object.values(updates), req.params.id]);

  res.json({ success: true, message: 'Product updated' });
});

router.delete('/:id', auth, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM products WHERE id = $1 AND farmer_id = $2', [req.params.id, req.user.id]);
  if (rowCount === 0) return err(res, 404, 'Not found or not yours', 'not_found');
  res.json({ success: true, message: 'Deleted' });
});

router.get('/:id/images', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC, id ASC', [req.params.id]);
  res.json({ success: true, data: rows });
});

router.patch('/:id/restock', auth, async (req, res) => {
  if (req.user.role !== 'farmer') return err(res, 403, 'Only farmers can restock', 'forbidden');
  const quantity = parseInt(req.body.quantity, 10);
  if (isNaN(quantity) || quantity <= 0) return err(res, 400, 'Quantity must be positive', 'validation_error');

  const { rows } = await db.query('SELECT * FROM products WHERE id = $1 AND farmer_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) return err(res, 404, 'Product not found', 'not_found');

  await db.query('UPDATE products SET quantity = quantity + $1, low_stock_alerted = 0 WHERE id = $2', [quantity, req.params.id]);
  
  if (rows[0].quantity === 0) {
    const processor = new AutomaticOrderProcessor();
    await processor.processWaitlistOnRestock(parseInt(req.params.id), quantity);
  }

  res.json({ success: true, message: 'Restocked' });
});

module.exports = router;
