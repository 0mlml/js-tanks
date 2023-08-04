# Tanks

Wii tanks inspired game written with the HTML5 canvas. It is a work in progress, but I never got around to finishing it. 

## How to play

A/D - Rotate left/right
W/S - Move forward/backward
Space - Drop mine
Click - Shoot
Mouse - Aim

### Notes:

- There is no map editor, so you have to edit the map as JSON.
- The way the tanks are implemented may seem odd with the `moveStates` property, but it was done thinking about networked multiplayer.
- - The issue is that this would require every client to have a synchronized copy of the game, and any desync would likely render the game unplayable.
- - There also is no interpolation, and would require the server to send updates at a high frequency.