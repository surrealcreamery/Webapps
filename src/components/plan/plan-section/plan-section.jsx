import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Button
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  return currencyFormatter.format(value);
};

const Ribbon = ({ children }) => (
    <Box
        sx={{
            position: 'relative',
            bgcolor: '#000000',
            color: '#FFFFFF',
            clipPath: 'polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%)',
            marginLeft: -2, 
            maxWidth: 'calc(100% + 16px)',
            width: 'fit-content',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
        }}
    >
        <Typography 
          variant="body2" 
          component="span" 
          sx={{ 
            fontWeight: 'bold',
            py: 0.5,
          }}
        >
            {children}
        </Typography>
    </Box>
);

/**
 * PlanCard
 */
export function PlanCard({
  group,
  subscriptionData,
  onEdit,
  onAdd,
  showAddButton = true,
  isSquareSection = false,
  internalPlans,
  onDeprecatePlan,
  title
}) {
  const locInfo =
    subscriptionData.find(l => l['Location Name'] === group.location) || {};
  
  const squarePlanId = group.plans?.[0]?.subscriptionPlanId || locInfo['Square Subscription Plan ID'] || group.id;

  const [locId, type] = group.id.split('-');

  const plansToShow = group.plans || [];

  const planMissingSquare = plan =>
    !plan['Square Plan ID'] && !plan['Square Plan Variation ID'];

  // ✅ MODIFIED: The useMemo hook now groups plans for both Square and Internal sections.
  const groupedPlans = useMemo(() => {
    if (!plansToShow) return {};

    if (isSquareSection) {
        // --- Logic for Square Plans ---
        if (!internalPlans) return {};
        return plansToShow.reduce((acc, plan) => {
            const internalPlan = internalPlans.get(plan.variationId);
            const primaryType = (internalPlan?.['Pricing Model Type'] || [])[0] || 'Uncategorized';
            const secondaryType = internalPlan?.['Plan Type'] || 'Uncategorized Plan Type';

            if (!acc[primaryType]) {
                acc[primaryType] = {};
            }
            if (!acc[primaryType][secondaryType]) {
                acc[primaryType][secondaryType] = [];
            }
            acc[primaryType][secondaryType].push(plan);
            return acc;
        }, {});
    } else {
        // --- ADDED: Grouping logic for Internal Plans ---
        return plansToShow.reduce((acc, plan) => {
            const primaryType = plan['Frequency'] || 'Uncategorized'; // e.g., 'Monthly', 'Annual'
            const secondaryType = plan['Plan Type'] || 'Uncategorized Plan Type'; // e.g., 'Base', 'Upgrade'

            if (!acc[primaryType]) {
                acc[primaryType] = {};
            }
            if (!acc[primaryType][secondaryType]) {
                acc[primaryType][secondaryType] = [];
            }
            acc[primaryType][secondaryType].push(plan);
            return acc;
        }, {});
    }
  }, [plansToShow, internalPlans, isSquareSection]);

  return (
    <Card sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
      <CardContent sx={{ pt: 2, px: 2, pb: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {group.location}
          </Typography>
          {isSquareSection && title === 'ALL SQUARE PLANS' && onDeprecatePlan && (
            <Button 
              size="small" 
              color="primary"
              onClick={() => onDeprecatePlan(squarePlanId, group.location)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', flexShrink: 0, ml: 1 }}
            >
              Deprecate Plan
            </Button>
          )}
        </Box>

        <Typography variant="body2" sx={{ mb: 1 }}>
          Square Plan ID: {squarePlanId ?? 'None'}
        </Typography>
        
        {isSquareSection ? (
          // --- RENDER LOGIC FOR SQUARE PLANS (Unchanged) ---
          <>
            <Divider />
            {Object.keys(groupedPlans).length > 0 ? (
              Object.entries(groupedPlans).map(([primaryType, secondaryGroups], index) => (
                <React.Fragment key={primaryType}>
                  {index > 0 && <Divider sx={{ my: 2 }} />}
                  <Box sx={{ pt: 2 }}>
                    <Ribbon>{primaryType} Plans</Ribbon>
                    {Object.entries(secondaryGroups).map(([secondaryType, plansInGroup]) => (
                      <Box key={secondaryType} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
                          {secondaryType}
                        </Typography>
                        {plansInGroup.map((plan, idx) => {
                           const associatedInternalPlan = internalPlans?.get(plan.variationId);
                           const priceInDollars = plan.Price / 100;
                          return (
                              <React.Fragment key={plan.variationId}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1, width: '100%' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Button
                                          sx={{ p: 0, textTransform: 'none', minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', cursor: 'pointer' }}
                                          onClick={e => { e.stopPropagation(); onEdit(plan, group.location); }}
                                        >
                                          {plan['Plan Name']}
                                        </Button>
                                        <Typography variant="body2">{formatCurrency(priceInDollars)}</Typography>
                                      </Box>
                                      {associatedInternalPlan && (
                                        <Typography variant="body2" color="text.secondary" sx={{pl: 1}}>
                                          Linked to: {associatedInternalPlan['Plan Name']}
                                        </Typography>
                                      )}
                                    </Box>
                                    {idx < plansInGroup.length - 1 && <Divider />}
                              </React.Fragment>
                            )
                          })}
                        </Box>
                      ))}
                    </Box>
                </React.Fragment>
              ))
            ) : (
              <Box sx={{ py: 2, textAlign: 'left' }}>
                <Typography variant="body2" color="textSecondary">
                  There are no active plan variations for this Square plan.
                </Typography>
              </Box>
            )}
          </>
        ) : (
          // ✅ MODIFIED: The rendering logic for Internal Plans now uses the grouped data and Ribbons.
          <>
            <Divider />
            {Object.keys(groupedPlans).length > 0 ? (
              Object.entries(groupedPlans).map(([primaryType, secondaryGroups], index) => (
                <React.Fragment key={primaryType}>
                    {index > 0 && <Divider sx={{ my: 2 }} />}
                    <Box sx={{ pt: 2 }}>
                        <Ribbon>{primaryType} Plans</Ribbon>
                        {Object.entries(secondaryGroups).map(([secondaryType, plansInGroup]) => (
                            <Box key={secondaryType} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>
                                    {secondaryType}
                                </Typography>
                                {plansInGroup.map((plan, idx) => (
                                    <React.Fragment key={plan.id}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1.5, width: '100%' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Button
                                                    sx={{ p: 0, textTransform: 'none', minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', cursor: 'pointer' }}
                                                    onClick={e => { e.stopPropagation(); onEdit(plan, group.location); }}
                                                >
                                                    {plan['Plan Name']}
                                                </Button>
                                                <Typography variant="body2">{formatCurrency(plan.Price)}</Typography>
                                            </Box>
                                            {plan['Add On'] && (
                                                <Typography variant="body1" sx={{ textTransform: 'none', justifyContent: 'flex-start', textAlign: 'left' }}>
                                                    {plan['Add On']}
                                                </Typography>
                                            )}
                                            {planMissingSquare(plan) && (
                                                <Typography variant="body2" color="warning.main">
                                                    No Square Plan
                                                </Typography>
                                            )}
                                        </Box>
                                        {idx < plansInGroup.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </Box>
                        ))}
                    </Box>
                </React.Fragment>
              ))
            ) : (
              <Box sx={{ py: 2, textAlign: 'left' }}>
                <Typography variant="body2" color="textSecondary">
                  No plans in this group.
                </Typography>
              </Box>
            )}
          </>
        )}

        <Divider sx={{ mt: 1 }}/>
        {showAddButton && onAdd && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1.5 }}>
            <Button
              startIcon={<AddIcon />}
              sx={{ textTransform: 'none' }}
              onClick={e => { e.stopPropagation(); onAdd(squarePlanId, group.location, type); }}
            >
              {isSquareSection ? 'Add Plan Variation' : 'Add A New Plan'}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PlanSection
 */
export default function PlanSection({
  title,
  groups = [],
  onEdit,
  onAdd,
  subscriptionData,
  showAddButton = true,
  isSquareSection = false,
  internalPlans,
  onDeprecatePlan
}) {
  return (
    <Box sx={{
        mb: 4,
        mx: 'auto',
        maxWidth: 600,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 'bold',
          fontSize: '0.875rem',
          textAlign: 'left'
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map(grp => (
          <PlanCard
            key={grp.id}
            group={grp}
            subscriptionData={subscriptionData}
            onEdit={onEdit}
            onAdd={onAdd}
            showAddButton={showAddButton}
            isSquareSection={isSquareSection}
            internalPlans={internalPlans}
            onDeprecatePlan={onDeprecatePlan}
            title={title}
          />
        ))}
      </Box>
    </Box>
  );
}