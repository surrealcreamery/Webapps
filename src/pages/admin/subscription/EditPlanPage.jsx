import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AddEditPlanDialog from '@/components/plan/add-edit-plan-dialog/add-edit-plan-dialog';
import { usePlansContext } from '@/contexts/PlansContext';

export default function EditPlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { plan: initialPlan, from: returnTo } = location.state || {};
  const { locMap, pricingModels, savePlan, deletePlan } = usePlansContext();

  const [editPlan, setEditPlan] = useState(initialPlan || null);
  const [showValidation, setShowValidation] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!initialPlan) {
      navigate(returnTo || '/admin/plans', { replace: true });
    }
  }, [initialPlan, navigate, returnTo]);

  const handleAddPhase = () => {
    setEditPlan(p => ({
      ...p,
      phases: [
        ...(p.phases || []),
        {
          uid: Date.now().toString(),
          cadence: '',
          periods: 1,
          pricing: { type: 'STATIC', price_money: { amount: 0, currency: 'USD' } },
        },
      ],
    }));
  };

  const handleRemovePhase = uid => {
    setEditPlan(p => ({ ...p, phases: (p.phases || []).filter(phase => phase.uid !== uid) }));
  };

  const handleClose = () => {
    navigate(returnTo || '/admin/plans');
  };

  const handleSave = async () => {
    setShowValidation(true);
    await savePlan(editPlan);
    navigate(returnTo || '/admin/plans');
  };

  const handleDelete = async () => {
    await deletePlan(editPlan.id);
    navigate('/admin/plans');
  };

  const handleChooseSquarePlan = () => {
    navigate('/admin/select-square-plan', { state: { from: location.pathname, selectedSquare: editPlan } });
  };

  if (!editPlan) return null;

  return (
    <AddEditPlanDialog
      open
      editPlan={editPlan}
      locMap={locMap}
      pricingModels={pricingModels}
      showValidation={showValidation}
      onClose={handleClose}
      onChangePlan={setEditPlan}
      onSave={handleSave}
      onDelete={handleDelete}
      handleAddPhase={handleAddPhase}
      handleRemovePhase={handleRemovePhase}
      confirmDeleteOpen={confirmDeleteOpen}
      setConfirmDeleteOpen={setConfirmDeleteOpen}
      onChooseSquarePlan={handleChooseSquarePlan}
    />
  );
}
