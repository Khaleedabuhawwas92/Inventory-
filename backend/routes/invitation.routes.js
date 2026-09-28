const express = require('express');
const invitationController = require('../controllers/invitation.controller');
const { createInvitationRules } = require('../validators/invitation.validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const permit = require('../middleware/permit');

const router = express.Router();

router.use(authenticate);

router.get('/', permit('invitations.manage'), invitationController.list);
router.post('/', permit('invitations.manage'), createInvitationRules, validate, invitationController.create);
router.post('/:id/revoke', permit('invitations.manage'), invitationController.revoke);

module.exports = router;
