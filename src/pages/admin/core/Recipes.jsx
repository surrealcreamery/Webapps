// src/pages/admin/subscription/Recipes.jsx
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Placeholder data for the recipe cards with categories
const recipeData = [
  {
    title: 'Classic Vanilla Cupcake',
    thumbnail: 'https://placehold.co/600x400/EFEFEF/333333?text=Vanilla+Cupcake',
    category: 'Cupcakes',
  },
  {
    title: 'Red Velvet Cupcake Jar',
    thumbnail: 'https://placehold.co/600x400/FFCDD2/333333?text=Red+Velvet+Jar',
    category: 'Cupcake Jars',
  },
  {
    title: 'Cookies & Cream Ice Cream Jar',
    thumbnail: 'https://placehold.co/600x400/BDBDBD/333333?text=Cookies+%26+Cream',
    category: 'Ice Cream Cupcake Jars',
  },
  {
    title: 'Strawberry Cheesecake Mason Jar',
    thumbnail: 'https://placehold.co/600x400/F8BBD0/333333?text=Strawberry+Cheesecake',
    category: 'Ice Cream Mason Jars',
  },
  {
    title: 'Chocolate Fudge Cupcake',
    thumbnail: 'https://placehold.co/600x400/8D6E63/FFFFFF?text=Chocolate+Cupcake',
    category: 'Cupcakes',
  },
  {
    title: 'Lemon Blueberry Cupcake Jar',
    thumbnail: 'https://placehold.co/600x400/FFF9C4/333333?text=Lemon+Jar',
    category: 'Cupcake Jars',
  },
];

const categories = [
  'Cupcakes',
  'Cupcake Jars',
  'Ice Cream Cupcake Jars',
  'Ice Cream Mason Jars',
];

const Recipes = ({ fetchedPermissions }) => {

  // Page-level access check
  if (!fetchedPermissions?.view) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No access to Recipes</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Recipe Management
      </Typography>
      
      <Box>
        {categories.map((category, index) => (
          <Accordion key={index}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls={`panel${index}a-content`}
              id={`panel${index}a-header`}
            >
              <Typography variant="h6">{category}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {/* ✨ DIAGNOSTIC: Added a red border to visualize the grid container's size */}
              <Grid container spacing={3} sx={{ border: '2px solid red' }}>
                {recipeData
                  .filter(recipe => recipe.category === category)
                  .map((recipe, recipeIndex) => (
                    <Grid item xs={6} sm={4} md={3} key={recipeIndex}>
                      <Card 
                        elevation={2}
                        sx={{
                          width: '100%',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4,
                          }
                        }}
                      >
                        <CardActionArea>
                          <CardMedia
                            component="img"
                            height="140"
                            image={recipe.thumbnail}
                            alt={recipe.title}
                          />
                          <CardContent>
                            <Typography gutterBottom variant="h6" component="div">
                              {recipe.title}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};

export default Recipes;
