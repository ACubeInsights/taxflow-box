import express from 'express';
import employeeService from '../services/employeeService.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { assertPasswordPolicy } from '../utils/authUtils.js';

const router = express.Router();

/**
 * GET /api/employees
 * Lists all employees (for dropdowns, assignment, etc.)
 */
router.get('/', requireAuth, requireRole('superadmin', 'employee'), async (req, res, next) => {
  try {
    const employees = await employeeService.listEmployees();
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, requireRole('superadmin'), async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    try {
      assertPasswordPolicy(password);
    } catch (policyErr) {
      return res.status(400).json({ error: policyErr.message });
    }
    const boxRole = 'user';
    const result = await Promise.race([
      employeeService.createEmployee(name, email, boxRole, password),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), 30000)),
    ]);
    res.status(201).json(result);
  } catch (error) {
    console.error('Employee creation error:', error.message);
    next(error);
  }
});

export default router;
