// workout-tracker.js

class WorkoutTracker {
    constructor() {
        this.currentWorkout = null;
        this.workoutHistory = [];
        this.restTimer = null;
        this.workoutTimer = null;
        this.isResting = false;
        this.currentSetStartTime = null;
        this.totalRestTime = 0;
        
        this.initializeApp();
    }

    async initializeApp() {
        // Initialize Firebase
        const auth = getAuth();
        this.db = getFirestore();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial workout data
        await this.loadWorkoutData();
    }

    async loadWorkoutData() {
        try {
            const workoutDays = await getDocs(collection(this.db, 'workoutDays'));
            this.workoutData = {};
            workoutDays.forEach(doc => {
                this.workoutData[doc.id] = doc.data();
            });
        } catch (error) {
            console.error('Error loading workout data:', error);
            this.showError('Failed to load workout data');
        }
    }

    startWorkout(dayId) {
        this.currentWorkout = {
            dayId,
            startTime: new Date(),
            exercises: [],
            totalRestTime: 0
        };
        
        this.showWorkoutInterface(dayId);
    }

    showWorkoutInterface(dayId) {
        const workoutDay = this.workoutData[dayId];
        const mainContent = document.getElementById('main-content');
        
        let html = `
            <div class="workout-session">
                <h2>${workoutDay.name}</h2>
                <div class="workout-progress">
                    <div class="current-exercise">
                        <h3>Current Exercise: <span id="current-exercise-name"></span></h3>
                        <div class="timer" id="exercise-timer">00:00</div>
                        <div class="set-counter">Set: <span id="current-set">0</span>/${workoutDay.workouts[0].count}</div>
                    </div>
                    <div class="controls">
                        <button id="start-exercise" class="button button-primary">Start Exercise</button>
                        <button id="complete-set" class="button button-success" disabled>Complete Set</button>
                        <button id="start-rest" class="button button-secondary" disabled>Start Rest</button>
                        <button id="skip-exercise" class="button button-danger">Skip Exercise</button>
                        <button id="pause-workout" class="button button-warning">Pause</button>
                    </div>
                    <div class="rest-timer" style="display: none;">
                        Rest Time: <span id="rest-timer">00:00</span>
                    </div>
                </div>
                <div class="workout-summary" style="display: none;">
                    <h3>Completed Exercises</h3>
                    <div id="completed-exercises"></div>
                </div>
            </div>
        `;
        
        mainContent.innerHTML = html;
        this.setupWorkoutEventListeners();
        this.startNextExercise();
    }

    setupWorkoutEventListeners() {
        document.getElementById('start-exercise').addEventListener('click', () => this.startExercise());
        document.getElementById('complete-set').addEventListener('click', () => this.completeSet());
        document.getElementById('start-rest').addEventListener('click', () => this.startRest());
        document.getElementById('skip-exercise').addEventListener('click', () => this.skipExercise());
        document.getElementById('pause-workout').addEventListener('click', () => this.togglePause());
    }

    startExercise() {
        const exercise = this.getCurrentExercise();
        this.currentSetStartTime = new Date();
        
        document.getElementById('start-exercise').disabled = true;
        document.getElementById('complete-set').disabled = false;
        
        this.startExerciseTimer();
    }

    completeSet() {
        const exercise = this.getCurrentExercise();
        const setDuration = (new Date() - this.currentSetStartTime) / 1000;
        
        this.currentWorkout.exercises.push({
            name: exercise.name,
            setNumber: this.getCurrentSetNumber(),
            duration: setDuration
        });
        
        document.getElementById('complete-set').disabled = true;
        document.getElementById('start-rest').disabled = false;
        
        this.stopExerciseTimer();
        this.updateCompletedExercises();
        
        if (this.isWorkoutComplete()) {
            this.completeWorkout();
        } else {
            this.showRestTimer();
        }
    }

    startRest() {
        this.isResting = true;
        this.restStartTime = new Date();
        
        document.getElementById('start-rest').disabled = true;
        document.querySelector('.rest-timer').style.display = 'block';
        
        this.startRestTimer();
    }

    startRestTimer() {
        this.restTimer = setInterval(() => {
            const restTime = (new Date() - this.restStartTime) / 1000;
            document.getElementById('rest-timer').textContent = this.formatTime(restTime);
        }, 1000);
    }

    skipExercise() {
        if (confirm('Are you sure you want to skip this exercise?')) {
            this.stopAllTimers();
            this.startNextExercise();
        }
    }

    togglePause() {
        const pauseButton = document.getElementById('pause-workout');
        if (this.isPaused) {
            this.resumeWorkout();
            pauseButton.textContent = 'Pause';
        } else {
            this.pauseWorkout();
            pauseButton.textContent = 'Resume';
        }
        this.isPaused = !this.isPaused;
    }

    async completeWorkout() {
        this.stopAllTimers();
        
        const summary = this.generateWorkoutSummary();
        await this.saveWorkoutData(summary);
        
        this.showWorkoutSummary(summary);
    }

    async saveWorkoutData(summary) {
        try {
            const workoutRef = doc(collection(this.db, 'workoutLogs'));
            await setDoc(workoutRef, {
                ...summary,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error saving workout data:', error);
            this.showError('Failed to save workout data');
        }
    }

    generateWorkoutSummary() {
        return {
            dayId: this.currentWorkout.dayId,
            startTime: this.currentWorkout.startTime,
            endTime: new Date(),
            exercises: this.currentWorkout.exercises,
            totalRestTime: this.totalRestTime,
            totalDuration: (new Date() - this.currentWorkout.startTime) / 1000
        };
    }

    showWorkoutSummary(summary) {
        const mainContent = document.getElementById('main-content');
        
        let html = `
            <div class="workout-complete">
                <h2>🎉 Workout Complete! 🎉</h2>
                <div class="summary">
                    <h3>Workout Summary</h3>
                    <p>Total Duration: ${this.formatTime(summary.totalDuration)}</p>
                    <p>Total Rest Time: ${this.formatTime(summary.totalRestTime)}</p>
                    <h4>Exercises:</h4>
                    <ul>
        `;
        
        const exerciseStats = this.calculateExerciseStats(summary.exercises);
        Object.entries(exerciseStats).forEach(([name, stats]) => {
            html += `
                <li>
                    <strong>${name}</strong>
                    <ul>
                        <li>Sets Completed: ${stats.sets}</li>
                        <li>Average Set Duration: ${this.formatTime(stats.averageDuration)}</li>
                    </ul>
                </li>
            `;
        });
        
        html += `
                    </ul>
                </div>
                <button class="button button-primary" onclick="location.reload()">Start New Workout</button>
            </div>
        `;
        
        mainContent.innerHTML = html;
    }

    // Utility functions
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    calculateExerciseStats(exercises) {
        const stats = {};
        exercises.forEach(exercise => {
            if (!stats[exercise.name]) {
                stats[exercise.name] = {
                    sets: 0,
                    totalDuration: 0
                };
            }
            stats[exercise.name].sets++;
            stats[exercise.name].totalDuration += exercise.duration;
        });
        
        Object.values(stats).forEach(stat => {
            stat.averageDuration = stat.totalDuration / stat.sets;
        });
        
        return stats;
    }

    stopAllTimers() {
        if (this.workoutTimer) clearInterval(this.workoutTimer);
        if (this.restTimer) clearInterval(this.restTimer);
    }

    showError(message) {
        // Implement error display
        console.error(message);
        alert(message);
    }
}

// Initialize the app
const workoutTracker = new WorkoutTracker();
