// admin.js
class WorkoutAdmin {
    constructor(db) {
        this.db = db;
    }

    async loadWorkoutModification() {
        const mainContent = document.getElementById('main-content');
        const workoutDays = await this.getAllWorkoutDays();

        const html = `
            <div class="admin-container">
                <h2>Modify Workouts</h2>
                <div class="workout-days-container">
                    ${this.renderWorkoutDays(workoutDays)}
                </div>
                <button class="button button-primary" id="add-day-btn">Add New Day</button>
            </div>
        `;

        mainContent.innerHTML = html;
        this.setupAdminEventListeners();
    }

    async getAllWorkoutDays() {
        try {
            const snapshot = await getDocs(collection(this.db, 'workoutDays'));
            const days = {};
            snapshot.forEach(doc => {
                days[doc.id] = { id: doc.id, ...doc.data() };
            });
            return days;
        } catch (error) {
            console.error('Error loading workout days:', error);
            throw error;
        }
    }

    renderWorkoutDays(workoutDays) {
        return Object.values(workoutDays).map(day => `
            <div class="workout-day-card" data-day-id="${day.id}">
                <div class="day-header">
                    <h3 contenteditable="true" class="day-name">${day.name}</h3>
                    <button class="button button-danger delete-day">Delete Day</button>
                </div>
                <div class="workouts-list">
                    ${this.renderWorkouts(day.workouts)}
                </div>
                <button class="button button-secondary add-workout">Add Workout</button>
                <button class="button button-primary save-day">Save Changes</button>
            </div>
        `).join('');
    }

    renderWorkouts(workouts) {
        return workouts.map((workout, index) => `
            <div class="workout-item" data-workout-index="${index}">
                <input type="text" class="workout-name" value="${workout.name}">
                <select class="workout-type">
                    <option value="sets" ${workout.type === 'sets' ? 'selected' : ''}>Sets</option>
                    <option value="time" ${workout.type === 'time' ? 'selected' : ''}>Time</option>
                </select>
                <input type="number" class="workout-count" 
                    value="${workout.type === 'sets' ? workout.count : workout.duration / 60}"
                    min="1" step="1">
                <button class="button button-danger delete-workout">Remove</button>
            </div>
        `).join('');
    }

    setupAdminEventListeners() {
        // Add new day
        document.getElementById('add-day-btn').addEventListener('click', () => {
            this.addNewDay();
        });

        // Day-specific events
        document.querySelectorAll('.workout-day-card').forEach(card => {
            // Save changes
            card.querySelector('.save-day').addEventListener('click', () => {
                this.saveDay(card);
            });

            // Add workout
            card.querySelector('.add-workout').addEventListener('click', () => {
                this.addWorkout(card);
            });

            // Delete day
            card.querySelector('.delete-day').addEventListener('click', () => {
                this.deleteDay(card);
            });

            // Delete workout
            card.querySelectorAll('.delete-workout').forEach(button => {
                button.addEventListener('click', (e) => {
                    this.deleteWorkout(e.target.closest('.workout-item'));
                });
            });
        });
    }

    async addNewDay() {
        const newDay = {
            name: 'New Day',
            workouts: []
        };

        try {
            const docRef = await addDoc(collection(this.db, 'workoutDays'), newDay);
            const dayCard = document.createElement('div');
            dayCard.className = 'workout-day-card';
            dayCard.dataset.dayId = docRef.id;
            dayCard.innerHTML = this.renderWorkoutDays({ [docRef.id]: { id: docRef.id, ...newDay } });
            
            document.querySelector('.workout-days-container').appendChild(dayCard);
            this.setupAdminEventListeners();
        } catch (error) {
            console.error('Error adding new day:', error);
            alert('Failed to add new day');
        }
    }

    async saveDay(dayCard) {
        const dayId = dayCard.dataset.dayId;
        const workouts = [];

        dayCard.querySelectorAll('.workout-item').forEach(item => {
            const workout = {
                name: item.querySelector('.workout-name').value,
                type: item.querySelector('.workout-type').value,
                count: parseInt(item.querySelector('.workout-count').value)
            };

            if (workout.type === 'time') {
                workout.duration = workout.count * 60; // Convert minutes to seconds
                delete workout.count;
            }

            workouts.push(workout);
        });

        try {
            await updateDoc(doc(this.db, 'workoutDays', dayId), {
                name: dayCard.querySelector('.day-name').textContent,
                workouts
            });
            alert('Changes saved successfully');
        } catch (error) {
            console.error('Error saving changes:', error);
            alert('Failed to save changes');
        }
    }

    addWorkout(dayCard) {
        const workoutsList = dayCard.querySelector('.workouts-list');
        const newWorkout = document.createElement('div');
        newWorkout.className = 'workout-item';
        newWorkout.dataset.workoutIndex = workoutsList.children.length;
        
        newWorkout.innerHTML = this.renderWorkouts([{
            name: 'New Workout',
            type: 'sets',
            count: 3
        }]);

        workoutsList.appendChild(newWorkout);
        this.setupAdminEventListeners();
    }

    async deleteDay(dayCard) {
        if (!confirm('Are you sure you want to delete this day?')) return;

        const dayId = dayCard.dataset.dayId;
        try {
            await deleteDoc(doc(this.db, 'workoutDays', dayId));
            dayCard.remove();
        } catch (error) {
            console.error('Error deleting day:', error);
            alert('Failed to delete day');
        }
    }

    deleteWorkout(workoutItem) {
        if (!confirm('Are you sure you want to delete this workout?')) return;
        workoutItem.remove();
    }
}
