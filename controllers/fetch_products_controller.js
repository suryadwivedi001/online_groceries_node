module.exports.controller = function(app) {
  app.get('/fetch_products', async (req, res) => {
    try {
      const db = require('../helpers/db_helpers');
      const query = 'SELECT prod_id FROM product_detail';
      db.query(query, [], function(err, results) {
        if (err) {
          console.error("DB Error:", err);
          return res.status(500).json({ status: "0", message: "Database error" });
        }
        res.json({ status: "1", prod_ids: results.map(row => row.prod_id) });
      });
    } catch (e) {
      console.error("Internal Error:", e);
      res.status(500).json({ status: "0", message: "Internal server error" });
    }
  });
};
