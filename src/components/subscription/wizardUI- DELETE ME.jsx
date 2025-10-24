import React, { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import PhoneInput from 'react-phone-number-input/input';
import 'react-phone-number-input/style.css';

function WizardUI({ snapshot, send }) {
  const { context } = snapshot;

  // Define colors for our log groups
  const logColors = {
    wizard: 'brown',
    memo: 'grey',
    model: '#ffc107',    // Yellow
    location: '#00bcd4', // Cyan
    plan: '#6f42c1',      // Purple
  };

  // Define style helpers for the console logs
  const headerStyle = (color) => `background: ${color}; color: white; font-weight: bold; padding: 2px 6px; border-radius: 3px;`;
  const subStyle = (color) => `color: ${color};`;

  console.log(`%c[WIZARD UI] Component Render Cycle Starting.`, headerStyle(logColors.wizard));

  const { availableModels, availableLocations, allPlans } = useMemo(() => {
    if (!context.normalizedData) {
      console.log(`%c[Data Memo] No normalizedData in context yet. Returning empty.`, subStyle(logColors.memo));
      return { availableModels: [], availableLocations: [], allPlans: [] };
    }
    console.log(`%c[Data Memo] Using normalizedData from context.`, subStyle(logColors.memo));
    return {
      availableModels: context.normalizedData.models || [],
      availableLocations: context.normalizedData.locations || [],
      allPlans: context.normalizedData.plans || []
    };
  }, [context.normalizedData]);

  const filteredModels = useMemo(() => {
    console.log(`%c[Model Filtering] Starting calculation...`, headerStyle(logColors.model));
    console.log(`%c[Model Filtering] Current Flow Type: ${context.currentFlowType}, Initial UTM Models: ${context.initialUtmModels.length}, Selected Location ID: ${context.locationId}`, subStyle(logColors.model));
    console.log(`%c[Model Filtering] Current Snapshot Value: ${JSON.stringify(snapshot.value)}`, subStyle(logColors.model));

    let models = availableModels;

    if (context.initialUtmModels.length > 0 && context.currentFlowType !== 'changeModelWorkflow') {
        const utmModelsSet = new Set(context.initialUtmModels);
        models = models.filter(m => utmModelsSet.has(m.id));
        console.log(`%c[Model Filtering] Filtered by initial UTM Models. Count: ${models.length}`, subStyle(logColors.model));
    }

    if (snapshot.matches({ SubscriptionWorkflows: { planSelectionWorkflow: 'explicitUtmLocOnly.modelSelection' } })) {
        if (context.locationId) {
            const plansAtUtmLocation = allPlans.filter(p => p.locationIds.includes(context.locationId));
            const modelsValidForUtmLocation = new Set(plansAtUtmLocation.map(p => p.modelId));
            models = models.filter(m => modelsValidForUtmLocation.has(m.id));
            console.log(`%c[Model Filtering] Filtered for explicitUtmLocOnly flow with location. Count: ${models.length}`, subStyle(logColors.model));
        }
    }
    else if (context.locationId) {
        const plansAtSelectedLocation = allPlans.filter(p => p.modelId === context.modelId && p.locationIds.includes(context.locationId));
        const modelsValidForSelectedLocation = new Set(plansAtSelectedLocation.map(p => p.modelId));
        models = models.filter(m => modelsValidForSelectedLocation.has(m.id));
        console.log(`%c[Model Filtering] Filtered by currently selected location (general case). Count: ${models.length}`, subStyle(logColors.model));
    }

    console.log(`%c[Model Filtering] Finished. Final list of models to display:`, headerStyle(logColors.model), models);
    return models;
  }, [allPlans, availableModels, context.initialUtmModels, context.locationId, context.currentFlowType, snapshot]);


  const filteredLocations = useMemo(() => {
    console.log(`%c[Location Filtering] Starting calculation...`, headerStyle(logColors.location));
    console.log(`%c[Location Filtering] Current Flow Type: ${context.currentFlowType}, Initial UTM Locations: ${context.initialUtmLocations.length}, Selected Model ID: ${context.modelId}`, subStyle(logColors.location));
    
    let locations = availableLocations;

    if (context.initialUtmLocations.length > 0 && context.currentFlowType !== 'changeLocationWorkflow') {
        const utmLocationsSet = new Set(context.initialUtmLocations);
        locations = locations.filter(l => utmLocationsSet.has(l.id));
        console.log(`%c[Location Filtering] Filtered by initial UTM Locations. Count: ${locations.length}`, subStyle(logColors.location));
    }

    if (context.modelId) {
      const locationsForModel = new Set(allPlans.filter(p => p.modelId === context.modelId).flatMap(p => p.locationIds).filter(Boolean));
      locations = locations.filter(l => locationsForModel.has(l.id));
      console.log(`%c[Location Filtering] Filtered by selected Model. Count: ${locations.length}`, subStyle(logColors.location));
    }

    console.log(`%c[Location Filtering] Finished. Final list of locations to display:`, headerStyle(logColors.location), locations);
    return locations;
  }, [allPlans, availableLocations, context.initialUtmLocations, context.modelId, context.currentFlowType, snapshot]);


  const filteredPlans = useMemo(() => {
    console.log(`%c[Plan Filtering] Starting calculation...`, headerStyle(logColors.plan));
    console.log(`%c[Plan Filtering] Selected Model ID: "${context.modelId}", Selected Location ID: "${context.locationId}"`, subStyle(logColors.plan));

    if (!context.modelId || !context.locationId) {
      console.log(`%c[Plan Filtering] No Plans: Model or Location not selected yet.`, subStyle(logColors.plan));
      return [];
    }
    
    const plans = allPlans.filter(p => p.modelId === context.modelId && p.locationIds.includes(context.locationId));
    console.log(`%c[Plan Filtering] Finished. Found plans:`, headerStyle(logColors.plan), plans);
    return plans;
  }, [allPlans, context.modelId, context.locationId, snapshot]);

  const stepperSteps = useMemo(() => {
    const modelStepContent = (
      <>
        <Typography variant="h6" gutterBottom>Choose your preferred model:</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(filteredModels.length > 0) ? filteredModels.map(model => (
            <Card
              key={model.id}
              onClick={() => send({ type: 'SELECT_MODEL', id: model.id })}
              sx={{ my: 1, cursor: 'pointer', border: context.modelId === model.id ? '2px solid #007bff' : '1px solid grey', borderRadius: '8px', '&:hover': { borderColor: '#007bff' } }}
            >
              <CardContent>
                <Typography variant="h6">{model.name}</Typography>
                <Typography variant="body2" color="text.secondary">{model.description}</Typography>
              </CardContent>
            </Card>
          )) : <Typography>No models available for this criteria.</Typography>}
        </Box>
      </>
    );

    const locationStepContent = (
      <>
        <Typography variant="h6" gutterBottom>Where would you like to use it?</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(filteredLocations.length > 0) ? filteredLocations.map(location => (
            <Card
              key={location.id}
              onClick={() => send({ type: 'SELECT_LOCATION', id: location.id })}
              sx={{ my: 1, cursor: 'pointer', border: context.locationId === location.id ? '2px solid #007bff' : '1px solid grey', borderRadius: '8px', '&:hover': { borderColor: '#007bff' } }}
            >
              <CardContent>
                <Typography variant="h6">{location.name}</Typography>
              </CardContent>
            </Card>
          )) : <Typography>No locations available for this criteria.</Typography>}
        </Box>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => send({ type: 'BACK' })}>
            ← Back
          </Button>
        </Box>
      </>
    );

    const planStepContent = (
      <>
        <Typography variant="h6" gutterBottom>Pick the perfect plan for you:</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(filteredPlans.length > 0) ? filteredPlans.map(plan => (
            <Card
              key={plan.id}
              onClick={() => send({ type: 'SELECT_PLAN', id: plan.id })}
              sx={{ my: 1, cursor: 'pointer', border: context.planId === plan.id ? '2px solid #007bff' : '1px solid grey', borderRadius: '8px', '&:hover': { borderColor: '#007bff' } }}
            >
              <CardContent>
                <Typography variant="h6">{plan.name}</Typography>
                <Typography color="primary">${plan.price}/{plan.frequency}</Typography>
                <Typography variant="body2" color="text.secondary">{plan.description}</Typography>
              </CardContent>
            </Card>
          )) : <Typography>No plans available for this criteria.</Typography>}
        </Box>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => send({ type: 'BACK' })}>
            ← Back
          </Button>
        </Box>
      </>
    );

    let flowStepsDefinition = [];

    switch (context.currentFlowType) {
        case 'explicitUtmModelAndLoc':
            flowStepsDefinition = [{ id: 'planSelection', label: 'Select Plan', content: planStepContent }];
            break;
        case 'explicitUtmModelOnly':
            flowStepsDefinition = [
                { id: 'locationSelection', label: 'Select Location', content: locationStepContent },
                { id: 'planSelection', label: 'Select Plan', content: planStepContent },
            ];
            break;
        case 'explicitUtmLocOnly':
            flowStepsDefinition = [
                { id: 'modelSelection', label: 'Select Model', content: modelStepContent },
                { id: 'planSelection', label: 'Select Plan', content: planStepContent },
            ];
            break;
        case 'noUtmDefault':
        default:
            flowStepsDefinition = [
                { id: 'modelSelection', label: 'Select Model', content: modelStepContent },
                { id: 'locationSelection', label: 'Select Location', content: locationStepContent },
                { id: 'planSelection', label: 'Select Plan', content: planStepContent },
            ];
            break;
    }

    let activeStepIndex = -1;
    if (snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.noUtmDefault.modelSelection') ||
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.explicitUtmLocOnly.modelSelection') ||
        snapshot.matches('SubscriptionWorkflows.changeFlows.changeModelWorkflow.modelSelection')
        ) {
        activeStepIndex = flowStepsDefinition.findIndex(step => step.id === 'modelSelection');
    } else if (
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.noUtmDefault.locationSelection') ||
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.explicitUtmModelOnly.locationSelection') ||
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.explicitUtmLocOnly.locationSelection') ||
        snapshot.matches('SubscriptionWorkflows.changeFlows.changeLocationWorkflow.locationSelection')
    ) {
        activeStepIndex = flowStepsDefinition.findIndex(step => step.id === 'locationSelection');
    } else if (
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.noUtmDefault.planSelection') ||
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.explicitUtmModelOnly.planSelection') ||
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.explicitUtmLocOnly.planSelection') ||
        snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow.explicitUtmModelAndLoc') ||
        snapshot.matches('SubscriptionWorkflows.changeFlows.changeModelWorkflow.planSelection') ||
        snapshot.matches('SubscriptionWorkflows.changeFlows.changeLocationWorkflow.planSelection')
    ) {
        activeStepIndex = flowStepsDefinition.findIndex(step => step.id === 'planSelection');
    }

    return flowStepsDefinition.map((step, idx) => ({
      ...step,
      active: idx === activeStepIndex,
      completed: idx < activeStepIndex,
    }));

  }, [snapshot, context, availableModels, availableLocations, allPlans, filteredModels, filteredLocations, filteredPlans, send]);


  const renderContent = () => {
    console.log(`%c[WIZARD UI - RENDER] Current Snapshot Value:`, headerStyle(logColors.wizard), JSON.stringify(snapshot.value));

    if (snapshot.matches('initialSetup.loadingInitialData') || snapshot.matches('initialSetup.fetchingDataAndProcessing') || snapshot.matches('initialSetup.reconcileAndRoute')) {
        return (
            <Box sx={{ textAlign: 'center', padding: '50px' }}>
                <CircularProgress /><Typography sx={{ ml: 2, mt: 2 }}>Loading configuration...</Typography>
            </Box>
        );
    }
    if (snapshot.matches('failure')) {
        return (
            <Box sx={{ textAlign: 'center', padding: '50px', color: 'red' }}>
                <Alert severity="error">Failed to load initial configuration.</Alert>
                <Button variant="contained" onClick={() => send('RESET')}>Retry</Button>
            </Box>
        );
    }

    const isInPlanSelectionWorkflow = snapshot.matches('SubscriptionWorkflows.planSelectionWorkflow') || snapshot.matches('SubscriptionWorkflows.changeFlows');

    if (isInPlanSelectionWorkflow) {
        const activeMuiStep = stepperSteps.findIndex(step => step.active);
        return (
            <Box sx={{ width: '100%', mt: 2 }}>
                <Stepper activeStep={activeMuiStep} orientation="vertical">
                    {stepperSteps.map((step, index) => (
                        <Step key={step.id} expanded={step.active}>
                            <StepLabel>{step.label}</StepLabel>
                            <StepContent>{step.content}</StepContent>
                        </Step>
                    ))}
                </Stepper>
                {activeMuiStep !== -1 && activeMuiStep === stepperSteps.length - 1 && stepperSteps[activeMuiStep].active && (
                  <Paper square elevation={0} sx={{ p: 3, mt:2 }}>
                    <Typography>All selection steps completed.</Typography>
                    <Button variant="contained" onClick={() => send('SELECT_PLAN', { id: context.planId })} sx={{ mt: 1, mr: 1 }}>
                      Continue to Contact Info (UI Not Implemented)
                    </Button>
                    <Button variant="outlined" onClick={() => send('RESET')}>
                      Start Over
                    </Button>
                  </Paper>
                )}
            </Box>
        );
    }

    if (snapshot.matches('SubscriptionWorkflows.contactInfo')) {
      const { customer, modelId, locationId, planId, currentFlowType, normalizedData } = context;
      const selectedModel = normalizedData.models.find(m => m.id === modelId);
      const selectedLocation = normalizedData.locations.find(l => l.id === locationId);
      const selectedPlan = normalizedData.plans.find(p => p.id === planId);
  
      const canChangeModel = !['explicitUtmModelOnly', 'explicitUtmModelAndLoc'].includes(currentFlowType);
      const canChangeLocation = !['explicitUtmLocOnly', 'explicitUtmModelAndLoc'].includes(currentFlowType);
  
      const isFormValid = customer.firstName && customer.lastName && customer.email && customer.phone?.length > 10;
  
      const handleChange = (e) => {
          const { name, value } = e.target;
          send({ type: 'UPDATE_CUSTOMER_FIELD', field: name, value });
      };
  
      const handlePhoneChange = (phoneValue) => {
          send({ type: 'UPDATE_CUSTOMER_FIELD', field: 'phone', value: phoneValue || '' });
      };
  
      const handleSubmit = (e) => {
          e.preventDefault();
          if (isFormValid) {
              send({ type: 'SUBMIT_CONTACT' });
          }
      };
  
      return (
          <Box>
              <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>Your Selections</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography><strong>Model:</strong> {selectedModel?.name || 'N/A'}</Typography>
                      {canChangeModel && <Button size="small" onClick={() => send('CHANGE_MODEL')}>Change</Button>}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography><strong>Location:</strong> {selectedLocation?.name || 'N/A'}</Typography>
                      {canChangeLocation && <Button size="small" onClick={() => send('CHANGE_LOCATION')}>Change</Button>}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <Typography><strong>Plan:</strong> {selectedPlan?.name || 'N/A'} (${selectedPlan?.price}/{selectedPlan?.frequency})</Typography>
                  </Box>
              </Paper>
  
              <Paper elevation={2} sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>Contact Information</Typography>
                  <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2, display: 'grid', gap: 2, gridTemplateColumns: { sm: '1fr 1fr' } }}>
                      <TextField required name="firstName" label="First Name" value={customer.firstName} onChange={handleChange} fullWidth />
                      <TextField required name="lastName" label="Last Name" value={customer.lastName} onChange={handleChange} fullWidth />
                      <TextField required name="email" label="Email Address" type="email" value={customer.email} onChange={handleChange} fullWidth sx={{ gridColumn: '1 / -1' }} />
  
                      <Box sx={{ gridColumn: '1 / -1' }}>
                           <PhoneInput
                              international
                              withCountryCallingCode
                              country="US"
                              placeholder="Phone Number"
                              value={customer.phone}
                              onChange={handlePhoneChange}
                              className="mui-style-phone-input"
                           />
                      </Box>
                  </Box>
              </Paper>
  
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                  <Button variant="outlined" onClick={() => send('BACK')}>
                      ← Back
                  </Button>
                  <Button type="submit" variant="contained" onClick={handleSubmit} disabled={!isFormValid || snapshot.matches('contactInfo.submittingContact')}>
                      {snapshot.matches('contactInfo.submittingContact') ? <CircularProgress size={24} /> : 'Continue'}
                  </Button>
              </Box>
          </Box>
      );
    }
    if (snapshot.matches('SubscriptionWorkflows.authenticationOrPayment')) {
      return (
        <Box sx={{ textAlign: 'center', padding: '50px', border: '1px dashed #2196F3', backgroundColor: '#e3f2fd' }}>
          <Typography variant="h6">Authentication & Payment Step</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>This UI is currently a placeholder.</Typography>
          <Button variant="contained" onClick={() => send('RESET')} sx={{ mt: 2, ml: 1 }}>Start Over</Button>
        </Box>
      );
    }
    if (snapshot.matches('SubscriptionWorkflows.summary')) {
      return (
        <Box sx={{ textAlign: 'center', padding: '50px', border: '1px dashed #FFC107', backgroundColor: '#fff3e0' }}>
          <Typography variant="h6">Summary Step</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>Subscription process completed.</Typography>
          <Button variant="contained" onClick={() => send('RESET')}>Start Over</Button>
        </Box>
      );
    }

    return (
        <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed orange' }}>
            <p>Unhandled State: {JSON.stringify(snapshot.value)}</p>
            <Button variant="contained" onClick={() => send('RESET')}>Reset Wizard</Button>
        </div>
    );
  };

  return (
    <> 
      {renderContent()}
    </>
    
  );
}

export default WizardUI;