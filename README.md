# Minesweeper x Tetris: TGM

Similar to how Tetris TGM starts relatively difficult and gets harder, the aim here is to have a version that requires solving multiple boards of increasing difficulty. Each board is generated to be logically solvable and starts with an opening. Boards after the first start at wherever the last click was on the previous board. The boards are organized in levels:
 * Level 1: Two boards of 16x16, 30m and 40m. F for fail, D for one, D+ for two.
 * Level 2: Level 1 with no flags. C for one, C+ for two
 * Level 3: Level 2 with no numbers. A for one, A+ for two
 * Level 4: Level 3 with random colors. A for one, A+ for two.
 * Level 5: Level 1 with 52m and 65m. * for fail, *D for both.
 * Level 6: Level 5 with no flags. *C for two.
 * Level 7: Level 6 with no numbers. *B for two
 * Level 8: Level 7 with random colors. *A for two.
 * Special level: 16x16/40m but with no numbers or colors, and its own time limit. M for fail, GM for pass
 
There are two "Torikans" after level 4 and 8. If you aren't fast enough, the game will simply end as if you have reached the end of the levels. The actual time for this depends on how fast I can do it; the second barrier should be tough and the first should be a lot easier. The final level should also have a nontrivial time limit. Maybe there should be an overall time limit, something like 10-20 minutes, although it depends on how fast the second Torikan is.

Grades are subject to change, although there should be a GM grade at the very end. Maybe FDCBAS* and at some point an M grade. M when the special level is reached seems harsh, so maybe F/D/C, C/B, B/A, A/S, S, SS, SSS, M, M*/Gm.

Losing on one board ends the game. The results screen contains the board count (X/8 or X/16) and the time (X:YY:ZZ), as well as the grade.

In game, we should display the time and number of mines, as well as the current level and some icons explaining the restriction (a crossed out mine for NF, a crossed out number for no numbers, a Windows 4-spot with a ? for random colors, finally the same but crossed out for no colors).
