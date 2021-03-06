define(['scenario/deferred', 'scenario/eventAggregator'], function (deferred, events) {
	var scenario;

	function StepFailed(error) {
		this.message = error.message || error;
		this.stack = error.stack;
		if (error.constructor) {
			this.type = error.constructor.name;
		}
	}

	function Step(title, action) {
		this.title = title;
		this.action = action;
	}

	Step.prototype.run = function (previousResult) {
		var that = this, currentResult, test = deferred();

		try {
			currentResult = this.action(previousResult);
		} catch (error) {
			return this.fail(test, error);
		}

		if (currentResult && currentResult.then) {
			// currentResult is a promise
			currentResult.fail(function (error) {
				return that.fail(test, error);
			}).then(function (asyncResult) {
				asyncResult = asyncResult || previousResult;
				test.resolve(asyncResult);
			});

			return test;
		}

		return test.resolve(currentResult || previousResult);
	};

	Step.prototype.fail = function (test, error) {
		this.error = new StepFailed(error);
		events.publish('scenario.step.fail', this.toJSON());
		return test.reject(this.error);
	};

	Step.prototype.toJSON = function () {
		var json = {
			title: this.title
		};

		if (this.error) {
			json.error = {
				message: this.error.message,
				stack: this.error.stack,
				type: this.error.type
			};
		}
		return json;
	};

	function Scenario(title, setupSteps, metadata) {
		this.id = window.location.hash.substring(1);
		this.metadata = metadata || {};
		this.title = title;
		this.steps = [];
		this.testRun = deferred();
		this.setupSteps = setupSteps;
	}

	Scenario.prototype.addStep = function (step) {
		var that = this;
		this.steps.push(step);

		this.testPipeline = this.testPipeline.always(function () {
			events.publish('scenario.step.start', step.toJSON());
		}).fail(function (error) {
			step.error = {
				message: 'Step skipped due to previous failure'
			};
			events.publish('scenario.step.fail', step.toJSON());
		}).then(function (result) {
			return step.run(result);
		}).always(function () {
			events.publish('scenario.step.end', step.toJSON());
		});
	};

	Scenario.prototype.run = function () {
		var that = this;

		this.testPipeline = this.testRun.then(function () {
			events.publish('scenario.scenario.start', that.toJSON());
		});

		this.setupSteps();

		this.testPipeline.always(function (result) {
			if (that.testPipeline.state() === 'rejected') {
				that.error = result;
			}
			events.publish('scenario.scenario.end', that.toJSON());
		});

		this.testRun.resolve();
	};

	Scenario.prototype.toJSON = function () {
		var i, stepJSON = [];
		for (i = 0; i < this.steps.length; i++) {
			stepJSON.push(this.steps[i].toJSON());
		};

		var json = {
			id: this.id,
			metadata: this.metadata,
			title: this.title,
			steps: stepJSON
		};

		if (this.error) {
			json.error = this.error;
		}
		return json;
	};

	String.prototype._ = function (stepAction) {
		var step = new Step(this.toString(), stepAction);
		scenario.addStep(step);
	};

	return function (title, setupSteps, metadata) {
		scenario = new Scenario(title, setupSteps, metadata);
		scenario.run();
	}
});